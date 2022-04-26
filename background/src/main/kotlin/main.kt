import chrome.Chrome
import chrome.fetch
import chrome.tabs.query
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.w3c.fetch.Headers
import org.w3c.fetch.RequestInit
import kotlin.js.json

fun main() {
    Chrome.runtime.onMessage.addListener { message, sender, callback ->
        if (message.type == "FindLyrics") {
            println(message.query.unsafeCast<String>())

            GlobalScope.launch {
                requestSongPath(message.query.unsafeCast<String>()) { path ->
                    requestLyricsDiv(path) { htmlString ->
                        //console.log("htmlString $htmlString")
                        val firstEntry = htmlString.indexOf("data-lyrics-container=\"true\"") - 5
                        val lastEntry = htmlString.indexOf("<div class=\"Lyrics__Footer")
                        val substring = htmlString.substring(firstEntry, lastEntry).replace("href=","nop")

                        console.log("doc.getAttributeNames() $firstEntry $lastEntry $substring")
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
    return this.replace("<div data-", "<div style=\"font-weight: 400; font-family: 'YSTextMedium'; color: #444444; letter-spacing: 0.4px; padding: 32px;\" data-")
}

suspend inline fun sendRequestForActiveWindow(key: String, value: String) {
    val queryInfo = json("active" to true, "currentWindow" to true).unsafeCast<dynamic>()
    Chrome.tabs.query(queryInfo).run {
        Chrome.tabs.sendMessage(this[0].id!!,
            message = json(
                "type" to key,
                "value" to value
            )
        )
    }
}


private fun requestSongPath(query: String, onFetch: (String) -> Unit) {
    val token = "Bearer 5TQxk63ZJoaUE2VqBPeVBTejIta4rzgxIl2m-afyCZ10o4RIVCaXbau0IwVhlb3e"

    val headers = Headers().apply {
        append("Authorization", token)
        append("Access-Control-Allow-Origin", "*")
    }

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
    val token = "Bearer 5TQxk63ZJoaUE2VqBPeVBTejIta4rzgxIl2m-afyCZ10o4RIVCaXbau0IwVhlb3e"

    val headers = Headers().apply {
        append("Authorization", token)
        append("Access-Control-Allow-Origin", "*")
    }

    fetch(
        input = "https://genius.com$path",
        init = RequestInit(headers = headers)
    ).then { res ->
        res.text().then {
            onFetch.invoke(it)
        }
    }
}

/*
*
    Chrome.omnibox.onInputEntered.addListener { text, _ ->
        GlobalScope.launch {
            Chrome.tabs.create(CreateProperties(url = "https://forvo.com/word/$text/#ja"))
            Chrome.tabs.create(CreateProperties(url = "https://www.google.com/search?as_st=y&tbm=isch&hl=en&as_q=$text&as_epq=&as_oq=&as_eq=&imgsz=&imgar=&imgc=&imgcolor=&imgtype=&cr=countryJP&as_sitesearch=&safe=images&as_filetype=&as_rights="))
            Chrome.tabs.create(CreateProperties(url = "https://jisho.org/search/$text"))
            text.toList()
                .map { "http://www.kanjidamage.com/kanji/search?utf8=✓&q=$it" }
                .forEach { url -> Chrome.tabs.create(CreateProperties(url = url)) }
        }
    }


    Chrome.runtime.onMessage.addListener { message, _, _ ->
        if (message.type == "JishoDownload") {
            println(message.filename.unsafeCast<String>())
            println(message.url.unsafeCast<String>())
            // crashes all of chrome for some reason
            GlobalScope.launch {
                val downloadId = Chrome.downloads.download(DownloadOptions(
                    conflictAction = FilenameConflictAction.uniquify,
                    filename = message.filename.unsafeCast<String>(),
                    url = message.url.unsafeCast<String>())
                )

                if (downloadId == undefined) {
                    println(Chrome.runtime.lastError)
                }
            }
        }
    }
* */