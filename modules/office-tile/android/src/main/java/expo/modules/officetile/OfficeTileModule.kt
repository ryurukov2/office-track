package expo.modules.officetile

import android.content.ComponentName
import android.content.Context
import android.service.quicksettings.TileService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Lets JS tell the tile the current status, after every change made in the app, notification or widget. */
class OfficeTileModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OfficeTile")

    Function("setState") { status: String, subtitle: String ->
      val context = appContext.reactContext?.applicationContext ?: return@Function
      OfficeTileService.saveState(context, status, subtitle)
      TileService.requestListeningState(context, ComponentName(context, OfficeTileService::class.java))
    }
  }
}
