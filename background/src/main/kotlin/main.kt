import chrome.Chrome
import chrome.fetch
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.w3c.fetch.Headers
import org.w3c.fetch.RequestInit


val token = "Bearer 5TQxk63ZJoaUE2VqBPeVBTejIta4rzgxIl2m-afyCZ10o4RIVCaXbau0IwVhlb3e"

val headers = Headers().apply {
    append("Authorization", token)
    append("Access-Control-Allow-Origin", "*")
}

fun main() {
    Chrome.runtime.onMessage.addListener { message, sender, callback ->
        if (message.type == "FindLyrics") {
            println(message.query.unsafeCast<String>())

            GlobalScope.launch {
                requestSongPath(message.query.unsafeCast<String>()) { path ->
                    requestLyricsDiv(path) { htmlString ->
                        val firstEntry = htmlString.indexOf("data-lyrics-container=\"true\"") - 5
                        val lastEntry = htmlString.indexOf("<div class=\"Lyrics__Footer")
                        val substring = htmlString.substring(firstEntry, lastEntry).replace("href=","nop")

                        callback.invoke(substring.applyCustomCss())
                    }

                }
                println(Chrome.runtime.lastError)
            }
        }
        return@addListener true
    }

}

private fun String.applyCustomCss(): String {
    return this.replace("<div data-", "<div style=" +
            "\"font-weight: 400; " +
            "font-family: 'YSTextMedium';" +
            "color: #444444;" +
            "letter-spacing: 0.4px;" +
            "padding: 32px;\"" +
            " data-")
}

private fun requestSongPath(query: String, onFetch: (String) -> Unit) {
    fetch(
        input = "https://api.genius.com/search?q=$query",
        init = RequestInit(headers = headers)
    ).then { res ->
        res.text().then {
            val startPath = it.indexOf("\"path\":\"") + 8
            val endPath = it.indexOf("\",\"pyongs_count\"")
            val path = it.substring(startPath, endPath)
            onFetch.invoke(path)
            console.log(path)
        }
    }
}

private fun requestLyricsDiv(path: String, onFetch: (String) -> Unit) {

    fetch(
        input = "https://genius.com$path",
        init = RequestInit(headers = headers)
    ).then { res ->
        res.text().then {
            onFetch.invoke(it)
        }
    }
}
