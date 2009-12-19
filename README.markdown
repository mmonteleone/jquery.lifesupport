jQuery.lifesupport
==================
Smart, simple, and secure session management plugin for jQuery  
[http://github.com/mmonteleone/jquery.lifesupport][0]

The problem
-----------

### Cookie Authentication Basics

Yes, I know *you* are smart and already know this.  But lots of folks live high up in the oxygen-thin stratospheres of web framework abstractions these days and might appreciate a quick refresher.

Secure sites typically use cookies for identifying a previously-authenticated user and also for controlling the lifetime of that authentication via the lifetime of the cookie.  Many web frameworks hide the details of this and give it fancy names like Microsoft [ASP.NET Forms Authentication][2], but the mechanics are pretty much the same:  

1. User Authenticates against site via username+password, openid, etc.
2. Site responds to successful authentication with a newly minted authentication cookie (often set to expire after, say, twenty minutes)
3. Subsequent user requests to the site include the cookie, allowing the site to not have to re-authenticate the user again
    * If the user's request is near the end of the twenty minute lifespan, the site will re-issue a new cookie with an extended lifespan, thereby allowing the user to transparently keep using the site for as long as she's "clicking things".
    * If the user's request is past the end of the twenty minute lifespan, the site will not accept the cookie and user would be considered logged-out and asked to re-authenticate.
    
### Cookie Authentication Challenges

When used in conjunction with SSL and prudent avoidance of common web threats such as CSRF, XSS, clickjacking, and friends, the above pattern is already considered mostly secure.   **But it should not be considered user-friendly out of the box**.

*Common usability (and security) problem scenarios:*

1. **False positives for inactive users:** An authenticated user is perhaps digesting a long page or completing a very complicated form that might take longer than 20 minutes.  She clicks 'save' and suddenly realizes she's no longer logged in since her cookie expired after 20 minutes of no HTTP requests, and even worse, she probably lost all her hard work on the previous form.
    * The user had no warning her session was about to die
    * The user sees no reason it should have, as from her perspective, she had indeed been "active".
    * Some solutions to this involve transparently pinging the server via AJAX in order to always have a fresh cookie.  But this is often implemented such that even truly inactive users will continue to have their cookies renewed by the pinging page, thereby breaking the security of having a timeout in the first place.
2. **No browser knowledge of the expired cookie:**  An authenticatied user leaves browser open to sensitive data and leaves workstation.  Even though the cookie might have expired after 20 minutes, the sensitive data still sits wide open on the user's screen.
    * Some solutions to this involve displaying a popup warning near the end of the lifespan, but the popup is often implemented such that it is popup-blocked, or worse, not smart enough to know that a user has truly been active on the page even though she hasn't made a recent HTTP request (see above).

Life support's solution
-----------------------

Life Support is a tiny [jQuery][3] plugin that solves the above challenges by implementing a simple client-side infrastructure surrounding intelligently keeping a user's session alive, warning of impending logouts, and alerting the user of an actual logout, exposed through a small API and set of DOM events.  

For flexibility's sake, *jQuery.lifesupport includes no native UI* for communicating these events, instead allowing any pattern of UI to be attached to them.  However, *A default jQuery.lifesupport.ui is planned.*

### Basic Example

Given the setup...

    $(document).lifesupport({
        lifetime: 20 * 60,              // twenty minute session lifetime in seconds
        warnAt: 60,                     // warn of impending logout 60 seconds before
        refresh: '/session-ping.aspx',  // URL to request against via AJAX to keep cookie refreshed
        logout: '/logout.aspx'          // URL to redirect to when logged-out
    });        

- Life support will monitor the `document` for any `click`, `keyup`, `scroll`, or `resize` events, and consider any of these to indicate client-side user activity even in the absence of HTTP requests.  
- Every two minutes, if client-side user activity has been observed to have occurred within those past two minutes, an AJAX request will be made against the `refresh` option's URL, thereby keeping the site's cookie fresh.  
- When activity has not been observed for the duration of the lifetime seconds consecutively, then the user's browser will be redirected to the `logout` URL.  
- 60 seconds before the logout, the jQuery event `warn` will be raised on `document`.
- Every second between the warn event and logout, the jQuery `warnIncrement` will be raised on `document`, passing along the number of seconds remaining in the warning period.
- Any activity observed during the warning period will refresh the session *immediately* via AJAX pinging against the ping URL.

Any simple UI (popup, lightbox, what-have-you) can be bound to the `warn` and `warnIncrement` events to alert the user of an impending logout.  Otherwise, jQuery.lifesupport takes care of the rest.

Requirements, installation, and notes
-------------------------------------

Simply download [jquery.lifesupport.js][7] and include it.  

Alternatively, you can download the [zipped release][8] containing a minified build with examples and documentation or the development master with unit tests by cloning `git://github.com/mmonteleone/jquery.lifesupport.git`.

jQuery.lifesupport requires only [jquery][3] 1.3.2, and can be installed thusly:

    <script type="text/javascript" src="jquery-1.3.2.min.js"></script>
    <script type="text/javascript" src="jquery.lifesupport.min.js"></script>

jQuery.lifesupport includes a full unit test suite, and has been verified to work against Firefox 3.5, Safari 4, Internet Explorer 6,7,8, Chrome, and Opera 9 and 10.  Please feel free to test its suite against other browsers.

Complete API
------------

### Initiating

Within the `document.ready` event, call

    $(document).lifesupport(options);
   
where options is an object literal of options.  

As a shortcut,    

    $.lifesupport(options);  

is an alias for `$(document).lifesupport(options);`  Only one "instance" of `lifesupport` can be active for a given page at a time.

### Options

- **refresh**: either A URL to be requested against via AJAX, or an anonymous function to be executed upon refreshing of the user's session.
  - *default*: `function(){}`
- **logout**: either a URL to be redirected to, or an anonymous function to be executed upon termination of the user's session
  - *default*: `function(){}`
- **lifetime**: number of consecutive inactive seconds which can pass before logging out.  This should be set equal to or less than the seconds the application sets as the lifetime on the user's cookie.
  - *default*: `1200` (20 minutes)
- **warnAt**: number of seconds before a `logout` to begin raising the `warn` and `warnIncrement` events
  - *default*: `60` (1 minute)
- **refreshEvery**: length of the activity monitoring cycle in seconds, during which any observed client activity will cause a refresh to occur at the end of the cycle.
  - *default*: `120` (2 minutes)
- **events**: string list of DOM events which the refresh cycle will consider to infer client-side user activity
  - *default*: `'click,scroll,resize,keyup'`

### Events

- **refresh**:  raised before a refresh (callback or ajax request) is performed
- **logout**:  raised before a logout (callback or window relocation) is performed
- **warn**:  raised 60 seconds (or otherwise specified by the `warnAt` option) before a `logout` occurs.  
- **warnIncrement**:  raised on each second during the warning threshold, passing how many seconds left until `logout`

### Manual Functions

- **jQuery.lifesupport.stop()**:  Stops the life support event cycles as if it had never been initiated
- **jQuery.lifesupport.refresh()**:  Performs a manual refresh, identically to one which would have occurred had client-side activity been observed within a refresh cycle.
- **jQuery.lifesupport.logout()**:  Performs a manual logout, identically to one which would have occurred at the end of a lifetime amount of consecutive seconds of no observed client activity
- **jQuery.lifesupport.timeRemaining()**:  Returns the number of seconds currently remaining before a logout would occur.

How to Contribute
-----------------

Development Requirements (for building and test running):

* Ruby + Rake, PackR, rubyzip gems: for building and minifying
* Java: if you want to test using the included [JsTestDriver][6] setup

Clone the source at `git://github.com/mmonteleone/jquery.lifesupport.git` and have at it.

The following build tasks are available:

    rake build     # builds package and minifies
    rake test      # runs jQuery.lifesupport specs against QUnit testrunner in default browser
    rake server    # downloads, starts JsTestDriver server, binds common browsers
    rake testdrive # runs jQuery.lifesupport specs against running JsTestDriver server
    rake release   # builds a releasable zip package

&lt;shameless&gt;Incidentally jQuery.lifesupport's unit tests use QUnit along with my other projects, [Pavlov][4], a behavioral QUnit extension, and [DeLorean][5] for accurately faking time-bound unit tests (timeouts, intervals, and dates) &lt;/shameless&gt;

Changelog
---------

* 0.9.1 - Added support for jQuery.safetynet, where if safetynet is defined and being used, suppresses warnings before a logout redirect.  Also updated to latest qunit.
* 0.9.0 - Initial Release

License
-------

The MIT License

Copyright (c) 2009 Michael Monteleone, http://michaelmonteleone.net

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: http://github.com/mmonteleone/jquery.lifesupport "jQuery.lifesupport"
[1]: http://michaelmonteleone.net "Michael Monteleone"
[2]: http://msdn.microsoft.com/en-us/library/aa480476.aspx "Forms Authentication"
[3]: http://jquery.com "jQuery"
[4]: http://github.com/mmonteleone/pavlov "Pavlov"
[5]: http://github.com/mmonteleone/delorean "DeLorean"
[6]: http://code.google.com/p/js-test-driver/ "JsTestDriver"
[7]: http://github.com/mmonteleone/jquery.lifesupport/raw/master/jquery.lifesupport.js "raw lifesupport script"
[8]: http://cloud.github.com/downloads/mmonteleone/jquery.lifesupport/jquery.lifesupport.zip "jQuery.lifesupport Release"