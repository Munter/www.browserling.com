(function () {
    var defer = (function (document, script) {
        var scripts = {},
            firstScript = document.getElementsByTagName(script)[0];

        return function (urls, callback) {
            var ringRing = function () {
                    var callMe = true;
                    urls.forEach(function (url) {
                        if (typeof scripts[url] !== 'undefined' && !scripts[url].onloadDone) {
                            callMe = false;
                        }
                    });
                    if (callMe) {
                        callback();
                    }
                },
                callMe = callback && true;

            if (typeof urls === 'string') {
                urls = [urls];
            }

            urls.forEach(function (url) {
                var inc;

                if (typeof scripts[url] === 'undefined') {
                    callMe = false;
                    inc = document.createElement(script);
                    inc.async = true;
                    inc.src = url;
                    if (callback) {
                        inc.onload = function () {
                            if (!inc.onloadDone) {
                                inc.onloadDone = true;
                                ringRing();
                            }
                        };
                        inc.onreadystatechange = function () {
                            if (inc.readyState === "loaded" || inc.readyState === "complete") {
                                inc.onload();
                            }
                        };
                    }
                    firstScript.parentNode.insertBefore(inc, firstScript);
                    scripts[url] = inc;
                }
            });

            if (callMe) {
                ringRing();
            }
        };
    }(document, 'script'));

    var _gaq = _gaq || [];
    _gaq.push(['_setAccount', 'UA-19793659-1']);
    _gaq.push(['_trackPageview']);

    defer(('https:' === document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js');

    defer(['https://js.stripe.com/v1/', one.getStaticUrl('js/jquery.js')], function () {
        defer(one.getStaticUrl('bundle/webapp.js'));
    });
}());
