package expo.modules.officetile

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the "OfficeTileClick" JS task (registered in index.js) without opening the app. */
class OfficeTileTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val action = intent?.getStringExtra("action") ?: return null
    val data = Arguments.createMap().apply { putString("action", action) }
    return HeadlessJsTaskConfig("OfficeTileClick", data, 10_000, true)
  }
}
