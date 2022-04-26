allprojects {
    group = "com.mirbor"
    version = "0.1"

    repositories {
        mavenCentral()
        jcenter()
        maven("https://jitpack.io")
    }
}

plugins {
    distribution
    kotlin("js") version libs.versions.kotlin.get() apply false
}

val content: Configuration by configurations.creating

dependencies {
    content(projects.background) {
        targetConfiguration = "content"
    }
    content(projects.content) {
        targetConfiguration = "content"
    }
}

distributions {
    main {
        contents {
            from("manifest.json") {
                expand(
                        "name" to "Yandex Music Lyrics",
                        "version" to "${project.version}",
                        "description" to "Quickly auto find and show lyrics for Ya music"
                )
            }

            from(content)

            from(file("resources"))

            into("/")
        }
    }
}

