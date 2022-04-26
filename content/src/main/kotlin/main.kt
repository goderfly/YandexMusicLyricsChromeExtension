import chrome.Chrome
import chrome.runtime.Options
import kotlinx.browser.document
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.w3c.dom.*
import kotlin.js.json

external interface PlayerState {
    val playing: Boolean
    val title: String
    val artist: String
    val albumArt: String
}

fun main() {
    val observedNode = document.querySelector(".deco-pane-body") as Node

    MutationObserver { array, observer ->
        array.firstOrNull { it.attributeName == "data-unity-state" }?.let {
            val oldValue = it.oldValue
            val newValue = (it.target as Element).attributes["data-unity-state"]?.value ?: return@let

            if (oldValue != newValue) {
                JSON.parse<PlayerState>(newValue).apply {
                    makeRequestToGetLyrics("$artist $title")
                }
            }
        }
    }.observe(observedNode , MutationObserverInit(
        attributes = true,
        attributeOldValue = true
    ))

}

private fun makeRequestToGetLyrics(songName: String) {
    GlobalScope.launch {
        Chrome.runtime.sendMessageAsync(
            options = Options(true),
            message = json(
                "type" to "FindLyrics",
                "query" to songName
            ),
            callback = {
                println("get message in content sendMessageAsync: $it")
                insertLyricsInDiv(it.unsafeCast<String>())
            }
        )
    }
}

private fun insertLyricsInDiv(it: String) {
    document.querySelector(".sidebar__under")?.apply {
        innerHTML = it
    }
}

/*


    val playAudioButtons = document.getElementsByClassName("concept_audio")
        .asList()
        .map { it as HTMLAnchorElement }

    val audioContainers = document.getElementsByTagName("audio")
        .asList()
        .map { it as HTMLAudioElement }

    playAudioButtons.zip(audioContainers).forEach { (playButton, audioContainer) ->
        val downloadAudioButton = document.create.a(classes = "concept_light-status_link") {
            text("Download Audio")
            onClickFunction = {
                println("Clicking!")
                GlobalScope.launch {
                    val url = (audioContainer.firstElementChild as HTMLSourceElement).src
                    val filename = audioContainer.id.split(":").first() + ".mp3"

                    Chrome.runtime.sendMessage(message = json(
                        "type" to "JishoDownload",
                        "text" to url,
                        "filename" to filename
                    ))
                }
            }
        }
        playButton.parentNode?.insertBefore(downloadAudioButton, playButton.nextSibling)
    }

       Chrome.runtime.onMessage.addListener { message, sender, sendResponse ->
        if (message.type == "FindLyricsResult") {
            println("get message in content: " + message.unsafeCast<String>())
        }
        jsCalendarGraphElement?.innerHTML = message.unsafeCast<String>()
        return@addListener true

    }*/