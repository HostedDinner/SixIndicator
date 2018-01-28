About
==============

SixIndicator is a WebExtension Plugin which indicates via an icon, if you are viewing the website with IPv6 or IPv4.
When clicking on the icon, more information is shown, like the number of requests per domain and if these requests were made via IPv6 or IPv4.

This plugin is heavily inspired by Ashley Baldocks [SixOrNot](http://ashley.baldock.me/sixornot/) plugin, which is not maintained anymore, since Firefox has switched to WebExtensions.
It is completly written from scratch, but aims at looking similar than SixOrNot.
Another similar plugin is [WhatIP](https://github.com/aoikeiichi/WebExt-WhatIP), but it is missing the core feature, showing enhanced information.

Missing features (compoared to SixOrNot):

* Looking up other IP addresses for used domains. Showing only the Ip address, which was used
* Indicator, if website is IPv6-Only (due to above limitation)
* Local IP addresses
* HTTP/HTTPS indicator (will probably follow)
* Proxy info (would be possible and will probably follow)