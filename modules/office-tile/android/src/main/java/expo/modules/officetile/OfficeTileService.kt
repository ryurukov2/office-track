package expo.modules.officetile

import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.facebook.react.HeadlessJsTaskService
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Quick Settings tile. While checked in, a tap starts a break; another tap ends it.
 * When not checked in the tile is greyed out (check in from the app).
 *
 * The status is cached in SharedPreferences so the tile can render instantly without
 * starting React Native. A tap updates the cache right away, then runs the headless JS
 * task (OfficeTileTaskService) that records the break and re-syncs the real status.
 */
class OfficeTileService : TileService() {

  companion object {
    private const val PREFS = "office_tile"

    fun saveState(context: Context, status: String, subtitle: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("status", status)
        .putString("subtitle", subtitle)
        .apply()
    }

    /** Real status from the app's storage, falling back to the cached one. */
    fun status(context: Context): String =
      readStoredStatus(context)
        ?: context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("status", "out")
        ?: "out"

    /**
     * Reads today's events straight from AsyncStorage's SQLite database (RKStorage) and
     * derives the status like statusOf() in src/model.js. This keeps the tile right even when
     * the status changed somewhere that couldn't update the tile (e.g. a notification button).
     */
    private fun readStoredStatus(context: Context): String? = try {
      val file = context.getDatabasePath("RKStorage")
      if (!file.exists()) null else {
        val key = "day:" + SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
          db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf(key)).use { c ->
            var last = "out"
            if (c.moveToFirst()) {
              val events = JSONArray(c.getString(0))
              for (i in 0 until events.length()) {
                val type = events.getJSONObject(i).optString("type")
                if (type != "adjust") last = type
              }
            }
            when (last) { "break" -> "break"; "out" -> "out"; else -> "in" }
          }
        }
      }
    } catch (e: Exception) {
      null
    }

  }

  override fun onTileAdded() {
    super.onTileAdded()
    render()
  }

  override fun onStartListening() {
    super.onStartListening()
    render()
  }

  override fun onClick() {
    super.onClick()
    val current = status(this)
    if (current == "out") return

    val next = if (current == "break") "in" else "break"
    saveState(this, next, "")
    render(next) // show the expected result right away; JS re-syncs once it has saved

    // JS decides break/back from the real status; the cached one may be stale.
    val intent = Intent(this, OfficeTileTaskService::class.java).putExtra("action", "toggle")
    startService(intent)
    HeadlessJsTaskService.acquireWakeLockNow(this)
  }

  private fun render(status: String = status(this)) {
    val tile = qsTile ?: return
    when (status) {
      "break" -> {
        tile.label = "On break"
        tile.state = Tile.STATE_ACTIVE
      }
      "in" -> {
        tile.label = "In office"
        tile.state = Tile.STATE_INACTIVE
      }
      else -> {
        tile.label = "Office break"
        tile.state = Tile.STATE_UNAVAILABLE
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = when (status) {
        "break" -> "Tap when you're back"
        "in" -> "Tap to start a break"
        else -> "Check in first"
      }
    }
    tile.icon = Icon.createWithResource(this, R.drawable.office_tile_icon)
    tile.updateTile()
  }
}
