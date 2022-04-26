plugins {
    kotlin("js")
    kotlin("plugin.serialization") version "1.6.10"
}

kotlin {
    js(IR) {
        browser {
            binaries.executable()
        }
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core-js:1.6.0")
    implementation(projects.chromePlatformApi)
    implementation(libs.html)
}

val content: Configuration by configurations.creating

artifacts {
    add("content", file("$buildDir/distributions/${name}.js")) {
        builtBy("browserProductionWebpack")
    }
}
