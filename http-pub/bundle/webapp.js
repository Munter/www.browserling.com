var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/sign_in.js", function (require, module, exports, __dirname, __filename) {
module.exports = function (email, password, cb) {
    var params = { email : email, password : password };
    $.post('/account/sign-in/email', params)
        .success(function (res) {
            if (res === 'ok') cb(null)
            else cb(res.toString())
        })
        .error(function (req, etype, err) {
            cb(err.toString());
        })
    ;
};

});

require.define("/sign_out.js", function (require, module, exports, __dirname, __filename) {
module.exports = function (cb) {
    $.post('/account/sign-out')
        .success(function (res) {
            if (res === 'ok') cb(null)
            else cb(res.toString())
        })
        .error(function (req, etype, err) {
            cb(err.toString());
        })
    ;
};

});

require.define("/webapp.js", function (require, module, exports, __dirname, __filename) {
    var signIn = require('./sign_in');
var signOut = require('./sign_out');

$(document).ready(function () {
    var names = [ 'index', 'account', 'about', 'contact', 'video' ];
    for (var i = 0; i < names.length; i++) {
        (function (name) {
            $('a[href="#/' + name + '"]').click(function () {
                $(document).scrollTop(0);
                $('.content').hide();
                $('#' + name + '.content').fadeIn(200);
            });
            
            var ps = window.location.hash.replace(/^#/, '').split('/');
            if (ps.slice(0,2).join('/') === '/' + name) {
                $('a[href="#/' + name + '"]:first').trigger('click');
            }
        })(names[i]);
    }
});

$(document).ready(function () {
    var run = $('.run-bar .run');
    var pressed = false;
    
    function showError (err) {
        var errElem = form.next('.error')
            .fadeIn(200)
            .text(err.toString())
        ;
        $(document).scrollTop(
            errElem.offset().top - $(window).height() / 2
        );
    }
    
    var form = $('form.browser-form');
    form.submit(function (ev) {
        ev.preventDefault();
        form.addClass('busy');
        
        if (!pressed) {
            run.addClass('pressed');
            setTimeout(function () {
                run.removeClass('pressed');
                pressed = false;
            }, 200);
        }
        pressed = false;
        
        var uri = form[0].elements.uri.value;
        var browser = form[0].elements.browser.value;
        var version = form[0].elements.version.value;
        
        window.location.href = 'http://'
            + window.location.hostname
            + ':80' // hard-code port 80 for now, make dynamic later
            + '/encoder.html'
            + '#uri=' + encodeURIComponent(uri)
            + '&browser=' + encodeURIComponent(browser + '/' + version)
        ;
    });
    
    run.mousedown(function () {
        pressed = true;
        run.addClass('pressed');
    });
    
    run.mouseup(function () {
        run.removeClass('pressed');
    });
    
    form.find('.browsers .browser').each(function () {
        $(this).mousedown(function () {
            var browser = $(this).find('input').attr('class');
            form.find('input[name="browser"]').val(browser);
            
            form.find('.browsers .browser.active').removeClass('active');
            $(this).addClass('active');
        });
    });
    
    $('#footer .item .icon a img').each(function () {
        var src = {
            up : $(this).attr('src'),
            down : $(this).attr('src').replace(/\.png$/, '_pressed.png'),
        };
        
        (function () {
            var im = new Image();
            im.src = src.down;
        })();
        
        $(this)
            .mousedown(function (ev) {
                $(this).attr('src',
                    $(this).attr('src') === src.up
                    ? src.down : src.up
                );
            })
            .mouseup(mouseout)
            .mouseout(mouseout)
        ;
        
        function mouseout () {
            $(this).attr('src', src.up);
        }
    });
});

$(document).ready(function () {
    getBrowsers({ explorer : [ '6.0', '7.0', '8.0' ] });
});

function getBrowsers (exclude) {
    var form = $('.browser-form');
    
    function makeVersion (name, version) {
        var elem = $('<input>')
            .attr('type', 'button')
            .val(version)
            .addClass('version')
        ;
        if (exclude[name] && exclude[name].indexOf(version) >= 0) {
            elem.addClass('excluded');
        }
        else {
            elem.mousedown(function () {
                form.find('input[name="version"]').val(version);
                form.find('.versions .version.active').removeClass('active');
                $(this).addClass('active');
            });
        }
        return elem;
    }
    
    $.get('/browsers.json', function (browserList) {
        browserList.forEach(function (b) {
            form.find('.' + b.name).mousedown(function () {
                var versions = form.find('.versions');
                versions.empty();
                b.versions.forEach(function (v) {
                    makeVersion(b.name, v).appendTo(versions);
                });
                
                var lastElem = $('.version:last', versions);
                if (lastElem.val().match(/^\d+\.\d+$/)) {
                    lastElem.trigger('mousedown');
                }
                else {
                    lastElem.prev('.version').trigger('mousedown');
                }
                
                if (exclude[b.name]) {
                    $('<div>')
                        .addClass('unlock-message')
                        .append(
                            $('<a>').attr('href', '/#pricing').text('Upgrade'),
                            ' to a paid plan to unlock versions: ',
                            exclude[b.name].join(', ')
                        )
                        .appendTo(versions)
                    ;
                }
            });
        });
        
        $('.browser-form').find('.firefox').trigger('mousedown');
    });
}

$(document).ready(function () {
    checkWhoami();
});

function checkWhoami () {
    $.ajax({ url : '/account/whoami.json', dataType : 'json' })
        .success(function (user) {
            if (user && user.email) authedAs(user.email);
            if (user) loadAccount();
        })
        .error(function (req, etype, err) {
            $('#account-error')
                .fadeIn(200)
                .text(err.toString())
            ;
        })
    ;
}

function loadAccount () {
    $.ajax({ url : '/account.json', dataType : 'json' })
        .success(function (account) {
            var plan = account && account.plan || 'free';
            $('.using').removeClass('using');
            $('.plan.' + plan).addClass('using');
            $('#account span.plan').text(plan);
            $('#account img.plan')
                .attr('src', '/images/newsite/plans/' + plan + '.png')
            ;
            if (plan !== 'free') getBrowsers({});
            
            if (!account) return;
            if (!account.usage) {
                account.usage = { browserling : {}, testling : {} };
            }
            
            var stamp = (function () {
                var d = new Date;
                var y = d.getFullYear();
                var m = d.getMonth() + 1;
                return y + '/' + m;
            })();
            var minutes = Math.floor(
                ((account.usage.user.browserling || {})[stamp] || 0) / 60
            );
            
            $('#account-info .minutes').text(minutes);
            
            var used = Math.floor(
                ((account.usage.user.testling || {})[stamp] || 0) / 60
            );
            $('#account-info .testling-used').text(used);
            
            var limit = Math.floor(
                (account.testling && account.testling.limit || 30) / 60
            );
            $('#account-info .testling-limit').text(limit);
        })
        .error(function (req, etype, err) {
            $('#account-error')
                .fadeIn(200)
                .text(err.toString())
            ;
        })
    ;
}

$(document).ready(function () {
    $('#create-link').click(function (ev) {
        var down = toggleAccountTab($(this));
        if (down) {
            $('#sign-in').slideUp(200);
            $('#create').slideDown(200);
        }
        else {
            $('#create').slideUp(200);
            ev.preventDefault();
            window.location.hash = '';
        }
    });
    
    $('#create .close').click(function () {
        $('#create').slideUp(200);
        $('#create-link').removeClass('selected');
    });
    
    var submit = $('#create').find('input[type="submit"]');
    var pressed = false;
    submit.mousedown(function () {
        pressed = true;
    });
    
    $('#create').submit(function (ev) {
        ev.preventDefault();
        
        if (!pressed) {
            submit.addClass('pressed');
            setTimeout(function () {
                submit.removeClass('pressed');
            }, 200);
        }
        pressed = false;
        
        var params = {
            email : this.elements.email.value,
            password : this.elements.password.value
        };
        
        function showError (err) {
            $('#create .error')
                .text(err.toString())
                .fadeIn(200)
            ;
        }
        
        if (!params.email.match(/^[^@]+@[^@]+$/)) {
            showError('invalid email address')
        }
        else if (this.elements.confirm.value !== params.password) {
            showError('password confirmation disagrees')
        }
        else {
            $('#create .error').fadeOut(200);
            $.post('/account/create/email', params)
                .success(function (res) {
                    if (res === 'ok') {
                        authedAs(params.email);
                        loadAccount();
                    }
                    else $('#create .error').text(res.toString()).fadeIn(200)
                })
                .error(function (req, etype, err) {
                    $('#create .error').text(err.toString()).fadeIn(200)
                })
            ;
        }
    });
    
    if ((window.location.hash || '').replace(/^#\/?/,'') === 'create') {
        setTimeout(function () {
            $('#create-link').trigger('click');
        }, 500);
    }
});

$(document).ready(function () {
    $('#sign-in-link').click(function (ev) {
        var down = toggleAccountTab($(this));
        if (down) {
            $('#create').slideUp(200);
            $('#sign-in').slideDown(200);
        }
        else {
            $('#sign-in').slideUp(200);
            ev.preventDefault();
            window.location.hash = '';
        }
    });
    
    var submit = $('#sign-in').find('input[type="submit"]');
    var pressed = false;
    submit.mousedown(function () {
        pressed = true;
    });
    
    $('#sign-in').submit(function (ev) {
        ev.preventDefault();
        
        if (!pressed) {
            submit.addClass('pressed');
            setTimeout(function () {
                submit.removeClass('pressed');
            }, 200);
        }
        pressed = false;
        
        var email = this.elements.email.value;
        var password = this.elements.password.value;
        signIn(email, password, function (err) {
            if (err) return $('#sign-in .error').text(err).fadeIn(200);
            authedAs(email);
            loadAccount();
        });
    });
    
    $('#sign-in .close').click(function () {
        $('#sign-in').slideUp(200);
        $('#sign-in-link').removeClass('selected');
    });
    
    if ((window.location.hash || '').replace(/^#\/?/,'') === 'sign-in') {
        setTimeout(function () {
            $('#sign-in-link').trigger('click');
        }, 500);
    }
    
    $('#account-bar .sign-out-link').click(function () {
        signOut(function (err) {
            if (err) $('#account-error').text(err).fadeIn(200);
            else {
                $('#account-bar .authbar').hide();
                $('#account-bar .links').slideDown(200);
                $('#account-bar .links a').removeClass('selected');
                unauthBuyClicker();
                loadAccount();
                getBrowsers({ explorer : [ '6.0', '7.0', '8.0' ] });
            }
        });
    });
});

function unauthBuyClicker () {
    function onclick () {
        $(document).scrollTop(0);
        $('#create-link').trigger('click');
        $('#account-bar form .error')
            .empty()
            .text('create an account or sign in to buy a plan!')
            .addClass('notify')
            .show()
        ;
    }
    $('#pricing .buy').click(onclick);
    $('#purchase').submit(onclick);
}

$(document).ready(function () {
    unauthBuyClicker();
    
    function onclick () {
        $(this).unbind('click', onclick);
        var elem = $(this);
        $('.plan').slideUp(200, function () {
            elem.find('.more').fadeIn(200);
        });
        
        var amount = $(this).find('.amount').text();
        $('#purchase input[name="amount"]').val(amount);
        
        elem.stop(true, true).show();
        $('#pricing .back').show();
        if (elem.hasClass('using')) {
            $('#pricing .buy').hide();
        }
        else {
            if ($(this).hasClass('free')) {
                $('#pricing .buy').addClass('free');
            }
            else $('#pricing .buy').removeClass('free');
            
            $('#pricing .buy').show();
        }
    }
    
    $('#pricing .plan').click(onclick);
    
    $('#pricing .back').click(function (ev) {
        ev.preventDefault();
        $('#pricing .plan').click(onclick);
        
        $('.plan').fadeIn(400);
        $('.more').hide();
        $('#pricing .cc').hide();
        $('#pricing .back').hide();
        $('#pricing .buy').hide();
        $('#payment-success').hide();
    });
    
    $('#pricing .buy').mousedown(function () {
        var elem = $(this);
        elem.addClass('pressed');
        setTimeout(function () {
            elem.removeClass('pressed');
        }, 200);
    });
    
    $('#pricing .more.dedicated input').change(function () {
        var sum = 250;
        $('#pricing .more.dedicated input[type="checkbox"]').each(function () {
            if (this.checked) sum += 125;
        });
        $('#pricing .plan.dedicated .desc .price .amount').text(sum);
        $('#purchase input[name="amount"]').val(sum);
    });
});

$(document).ready(function () {
    $('#contact.content form').submit(function (ev) {
        ev.preventDefault();
        
        var form = $(this);
        var params = {
            email : this.elements.email.value,
            tag : this.elements.tag.value,
            comment : this.elements.comment.value
        };
        
        $.post('/contact/comment', params)
            .success(function (res) {
                if (res === 'ok') {
                    form.find('.thanks')
                        .text('Thanks for your comment!')
                        .fadeIn(200)
                    ;
                    form[0].elements.comment.value = '';
                }
                else form.next('.error').text(res.toString()).fadeIn(200)
            })
            .error(function (req, etype, err) {
                form.next('.error').text(err.toString()).fadeIn(200);
            })
        ;
    });
    
    $('#contact.content form textarea').change(function (ev) {
        function onchange () {
            $('#contact.content .error').fadeOut(1000);
            $('#contact.content .thanks').fadeOut(400);
        }
        $(this).change(onchange).keydown(onchange);
    });
});

$(document).ready(function () {
    var found = false;
    $('#video .body .video').each(function (ix) {
        var div = $(this);
        var a = $('<a>')
            .attr('href', '#/video/' + ix)
            .text(ix)
            .click(function () {
                $('#video .body .video').hide();
                $('#video .body .links .selected').removeClass('selected');
                $(this).addClass('selected');
                div.fadeIn(200);
            })
            .appendTo('#video .body .links')
        ;
        
        var hash = window.location.hash.replace(/^#/, '');
        if (hash === '/video/' + ix) {
            a.trigger('click');
            found = true;
        }
    });
    
    if (!found) $('#video .body .links a:first').trigger('click')
});

function toggleAccountTab (elem, cb) {
    if (elem.hasClass('selected')) {
        elem.removeClass('selected');
        return false;
    }
    else {
        $('#account-bar .links a').removeClass('selected');
        elem.addClass('selected');
        return true;
    }
}

function authedAs (email) {
    $('#account-bar .authbar').show();
    $('#account-bar .authbar .email').text(email);
    $('input.email').val(email);
    $('.from-email').hide();
    
    $('#sign-in').find('input[name="email"]').val('');
    $('#sign-in').find('input[name="password"]').val('');
    $('#account-bar')
        .find('.error')
        .removeClass('notify')
        .hide()
    ;
    
    $('#purchase').unbind('submit').submit(submitPayment);
    
    $('#account-bar .links').hide();
    if ($('#sign-in').is(':visible')) $('#sign-in').slideUp(200);
    if ($('#create').is(':visible')) $('#create').slideUp(200);
    
    var hash = window.location.hash.replace(/^#/, '');
    if (hash === '/sign-in' || hash === '/create') {
        window.location.hash = '/';
    }
    
    $('#pricing .buy').unbind('click').click(function () {
        var elem = $(this);
        var plan
            = $('.plan.free').is(':visible') ? 'free'
            : $('.plan.developer').is(':visible') ? 'developer'
            : $('.plan.dedicated').is(':visible') ? 'dedicated'
            : 'free'
        ;
        
        if (plan === 'free') {
            alert(
                'Not yet implemented. Please just contact us through our '
                + 'contact form and we\'ll downgrade your account by hand.'
            );
        }
        else {
            var extras = [];
            if (plan === 'dedicated') {
                $('#pricing .plan.dedicated input[type="checkbox"]')
                    .each(function () {
                        if (this.checked) extras.push(this.name);
                    })
                ;
            }
            
            $('.plan').slideUp(200, function () {
                $('#pricing .cc .plan-name').text(
                    plan
                    + (extras.length
                        && ' (+ ' + extras.join(', ') + ')'
                        || ''
                    ) + ' plan'
                );
                $('#pricing .cc input[name="plan"]').val(plan);
                $('#pricing .cc input[name="extras"]')
                    .val(extras.join(','));
                
                $('#pricing .cc').show();
            });
            $('#pricing .back').show();
            $('#pricing .buy').hide();
        }
    });
}

$(document).ready(function () {
    $('#sign-in .forget a').click(function (ev) {
        ev.preventDefault();
        var div = {
            error : $('#sign-in .error').hide(),
            notify : $('#sign-in .notify').hide()
        };
        
        var params = {
            email : $('#sign-in').get(0).elements.email.value
        };
        $.post('/account/forgot', params)
            .success(function (res) {
                if (res === 'ok') {
                    div.notify.fadeIn(400).text('password reset email sent');
                    form.get(0).elements.email.value = '';
                }
                else div.error.text(res.toString()).fadeIn(200)
            })
            .error(function (req, etype, err) {
                div.error.text(err.toString()).fadeIn(200)
            })
        ;
    });
});

$(document).ready(function () {
    var form = $('#account-password');
    var div = {
        error : form.find('.error').hide(),
        success : form.find('.success').hide()
    };
    
    form.submit(function (ev) {
        ev.preventDefault();
        div.error.hide();
        div.success.hide();
        
        var params = {
            current : form.get(0).elements.current.value,
            password : form.get(0).elements.password.value,
            confirm : form.get(0).elements.confirm.value
        };
        
        $.post('/account/email/change-password', params)
            .success(function (res) {
                if (res === 'ok') {
                    div.success.fadeIn(400);
                    
                    form.get(0).elements.current.value = '';
                    form.get(0).elements.password.value = '';
                    form.get(0).elements.confirm.value = '';
                }
                else div.error.text(res.toString()).fadeIn(200)
            })
            .error(function (req, etype, err) {
                div.error.text(err.toString()).fadeIn(200)
            })
        ;
    });
});

$(document).ready(function () {
    var names = [ 'info', 'testling', 'password' ];
    var hash = window.location.hash.replace(/^#/, '');
    
    for (var i = 0; i < names.length; i++) {
        (function (name) {
            var a = $('a[href="#/account/' + name + '"]').click(function () {
                $('#account .tabs a').removeClass('active');
                $(this).addClass('active');
                
                $('#account .body .form').hide();
                $('#account-' + name).fadeIn(200);
            });
            
            if (hash === '/account/' + name) a.trigger('click');
        })(names[i])
    }
});

Stripe.setPublishableKey(
    window.location.hostname === 'localhost'
    ? 'pk_icITe1Ccp2fHp0z3aYGbUYFg3XysC'
    : 'pk_0gnwtNdEka8cm4D5EKqzBF0MqZoRj'
);

function submitPayment (ev) {
    ev.preventDefault();
    var params = {};
    $(this).find('input').each(function () {
        params[this.name] = this.value;
    });
    $(this).unbind('submit');
    
    $('#purchase .error').hide();
    
    function disable () {
        $('#purchase input').each(function () {
            $(this).attr('disabled', true);
        });
        $('#purchase .purchase.button').hide();
        $('#purchase').unbind('submit');
        $('#purchase .busy').show();
    }
    
    function enable () {
        $('#purchase input').each(function () {
            $(this).attr('disabled', false);
        });
        $('#purchase .purchase.button').show();
        $('#purchase').unbind('submit').submit(submitPayment);
        $('#purchase .busy').hide();
    }
    
    disable();
    
    params.domain = 'browserling';
    
    var opts = {
        name : params.name,
        number : params.number,
        amount : params.amount,
        cvc : params.cvc,
        exp_month : params['expiry-month'],
        exp_year : params['expiry-year'],
    };
    Stripe.createToken(opts, 100 * params.amount, function (err, res) {
        if (res && res.error) {
            $('#purchase .error').text(res.error.message).show();
            enable();
            return;
        }
        
        delete params.number;
        
        params.stripeToken = res.id;
        $.post('/payment/stripe', params)
            .success(function (res) {
                if (res === 'ok') {
                    $('#purchase').hide();
                    $('#payment-success').fadeIn(200);
                    $('#pricing .back').hide();
                    loadAccount();
                }
                else {
                    $('#purchase .error').text(res.toString()).fadeIn(200);
                    enable();
                }
            })
            .error(function (req, etype, err) {
                $('#purchase .error').text(err.toString()).fadeIn(200)
                enable();
            })
        ;
    });
    
}

});
require("/webapp.js");
