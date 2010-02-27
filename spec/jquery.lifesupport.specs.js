// custom assertions
QUnit.specify.extendAssertions({
    // add in an assert(fn).isFunction()
    isFunction: function(actual, message) {
        ok($.isFunction(actual), message);
    }
});

QUnit.specify("jQuery.lifesupport", function() {
    
    var specification = function(){
        // setup some helpers        

        // capture local references to current jquery objects
        // since the globals may get out of sync in the async
        // test runner
        var $ = window.$,
            jQuery = window.jQuery;
        var is14OrGreater = Number($.fn.jquery.split('.').slice(0,2).join('.')) >= 1.4;

        // ================
        // = Spec Helpers =
        // ================

        var clockCycle = 1000;

        /**
         * Local interface to a fake/mocked clock
         */
        var mockClock = {
            advance: DeLorean.advance,
            reset: DeLorean.reset,
            offset: DeLorean.offset,
            setInterval: DeLorean.setInterval,
            setTimeout: DeLorean.setTimeout,
            clearInterval: DeLorean.clearInterval,
            clearTimeout: DeLorean.clearTimeout
        };

        /**
         * Mock window
         * Allows for programmatically controlling time
         */
        var mockWindow = {
            location: '',
            setInterval: mockClock.setInterval,
            setTimeout: mockClock.setTimeout,
            clearInterval: mockClock.clearInterval,
            clearTimeout: mockClock.clearTimeout
        };

        /**
         * "Waits" by incrementing the mocked clock
         * @param {Number} ms Number of milliseconds to fake wait for
         * @param {Function} fn Function to evaluate after fake waiting
         */
         var mockWait = function(ms, fn) {
             mockClock.setTimeout(fn, ms);
             mockClock.advance(ms);
         };

         var resetTest = function() {
            // always cancel lifesupport after tests
            $.lifesupport.stop();   
            // unbind any test-related events
            $(document).unbind('.spec');
            // reset fake time
            mockClock.reset();
         }

        // =========
        // = Specs =
        // =========

        describe('jQuery.lifesupport', function() {
            it("should be equivalent to calling $(document).lifesupport()", function(){
                var originalLifeSupportMethod = $.fn.lifesupport;
                var lifeSupportWasCalledOnDocument = false;
                try{
                    // mock the lifesupport method
                    $.fn.lifesupport = function() {
                        lifeSupportWasCalledOnDocument = 
                            this.length === 1 && 
                            $(document)[0] === this[0];
                    };
                    // test it
                    $.lifesupport({});                          
                }finally{
                    // restore original value of method
                    $.fn.lifesupport = originalLifeSupportMethod;                           
                }
                assert(lifeSupportWasCalledOnDocument).isTrue();
            });
        });

        describe('jQuery.fn.lifesupport', function() {

            after(resetTest);

            describe('default settings', function() {
                it("should have a 20 minute lifetime", function() {
                    assert($.fn.lifesupport.defaults.lifetime).equals(1200);
                });
                it("should have a 60 second warning", function() {
                    assert($.fn.lifesupport.defaults.warnAt).equals(60);
                });
                it("should have a 2 minute refresh interval", function() {
                    assert($.fn.lifesupport.defaults.refreshEvery).equals(120);
                });
                it("should monitor click, scroll, resize, keyup events", function() {
                    assert($.fn.lifesupport.defaults.events).equals('click,scroll,resize,keyup');
                });
                it("should have an anonymous function for refresh handling", function() {
                    assert($.fn.lifesupport.defaults.refresh).isFunction();
                });
                it("should have an anonymous function for logout handling", function() {
                    assert($.fn.lifesupport.defaults.logout).isFunction();
                });
                it("should have a clock cycle of 1000ms (1s)", function() {
                    assert($.fn.lifesupport.defaults.clockCycle).equals(1000);
                });
            });

            describe('refresh behavior', function(){

                var refreshCalled; 

                var lsopts = {
                    events: 'testevent',
                    lifetime: 10,  // 10 units of lifetime
                    warnAt: 5,  // warn at 5 units away
                    clockCycle: clockCycle,  
                    refreshEvery: 2,  // 2-unit refresh cycles
                    refresh: function() {
                        refreshCalled = true;                    
                    },
                    window: mockWindow
                };

                describe('when refreshing events have occurred during a refresh interval', function(){

                    var refreshTriggered = false;
                    var refreshTriggerTimeoutId;

                    before(function(){
                        refreshTriggered = false;
                        $(document)
                            .bind('refresh.spec', function(){
                                refreshTriggered = true;        
                            }).lifesupport(lsopts);                 

                        // after 3 units, trigger a refreshing event
                        refreshTriggerTimeoutId = mockClock.setTimeout(function(){                      
                            $('body').trigger('testevent');
                        }, clockCycle * 3);

                    });

                    it("should trigger refresh event", function(){
                       // wait until right after the 4 units of time for the above things to have occurred
                       mockWait(clockCycle * 4 + 1, function(){
                           assert(refreshTriggered).isTrue();
                       });                   
                    });

                    it("should not actually perform the refresh immedidately", function(){
                        // wait until right after event would have been triggered,
                        // but before the refresh cycle would have performed a refresh for it
                        mockWait(clockCycle * 3 + 1, function(){
                            assert(refreshTriggered).isFalse();
                        })                    
                    });

                    it("should renew remaining life", function(){

                        assert($.lifesupport.timeRemaining()).equals(lsopts.lifetime);

                        // wait until right after the refresh at 2 refresh cycles
                        // since refresh cycle is every 2 units, then check at 4 (second refresh)
                        // which happened right after the refresh event at unit 3

                        mockWait(clockCycle * 4 + 1, function(){
                            // validate that the remaining time has been reset
                            // subtracting 1 since by this point, another tick would have already happened
                            // in newly refreshed lifetime
                            assert($.lifesupport.timeRemaining()).equals(lsopts.lifetime-1);
                        });
                    });

                    describe('when refresh option is lambda', function(){
                        it('should call refresh lambda', function(){
                            // wait until right after a refresh would have been performed
                            mockWait(clockCycle * 4 + 1, function(){
                                // validate refresh lambda called
                                assert(refreshTriggered).isTrue();
                            });                                     
                        });
                    });

                    describe('when refresh option is a url', function() {
                        it('should ajax request against url', function() {
                            // mock the ajax $.get method
                            var originalGet = $.get;
                            var requestedUrl = '';
                            $.get = function(urlToGet) {
                                requestedUrl = urlToGet;
                            };

                            // set up an ajax lifesupporter
                            urlOpts = $.extend({}, lsopts, {refresh:'http://ping.url'});
                            $(document).lifesupport(urlOpts);

                            // wait for a refresh cycle to have occurred
                            mockWait(clockCycle * 4 + 1, function(){
                                // restore original value of get
                                $.get = originalGet;
                                assert(requestedUrl).equals('http://ping.url');
                            });                     
                        });

                        it("should append randomized querystring to end of url requests", function(){
                            // mock the ajax $.get method
                            var originalGet = $.get;
                            var randomizedQueries = [];
                            $.get = function(urlToGet, params) {
                                randomizedQueries.push(params['req']);
                            };

                            // set up an ajax lifesupporter
                            urlOpts = $.extend({}, lsopts, {refresh:'http://ping.url'});
                            $(document).lifesupport(urlOpts);

                            // wait for a refresh cycle to have occurred
                            mockWait(clockCycle * 4 + 1, function(){});                                             

                            // always cancel lifesupport after tests
                            $.lifesupport.stop();   
                            // unbind any test-related events
                            $(document).unbind('.spec');
                            // reset fake time
                            mockClock.reset();      

                            $(document)
                                .bind('refresh.spec', function(){
                                    refreshTriggered = true;        
                                }).lifesupport(lsopts);                 

                            // after 3 units, trigger a refreshing event
                            refreshTriggerTimeoutId = mockClock.setTimeout(function(){                      
                                $('body').trigger('testevent');
                            }, clockCycle * 3);


                            // set up an ajax lifesupporter
                            urlOpts = $.extend({}, lsopts, {refresh:'http://ping.url'});
                            $(document).lifesupport(urlOpts);

                            // wait for a refresh cycle to have occurred
                            mockWait(clockCycle * 4 + 1, function(){
                                // restore original value of get
                                $.get = originalGet;
                                assert(randomizedQueries.length).equals(2);
                                assert(randomizedQueries[0]).isNotEqualTo(randomizedQueries[1]);
                            });                                             
                        });
                    });

                });

                describe("when refreshing events have not occurred during a refresh interval", function(){                

                    it("should not refresh at refreshing interval", function(){
                        var refreshTriggered = false;
                        $(document)
                            .bind('refresh.spec', function(){
                                refreshTriggered = true;        
                            }).lifesupport(lsopts);                 

                        // after 3 units, trigger a refreshing event
                        mockClock.setTimeout(function(){                        
                            $('body').trigger('testevent');
                        }, clockCycle * 3);

                        // wait until right after the first refresh cycle would have occurred
                        mockWait(clockCycle * 2 + 1, function(){
                            // assert that a refresh wasn't performed
                            assert(refreshTriggered).isFalse();
                        });
                    });
                });

                describe("when refreshing event has occurred during warning period", function(){
                    it("refresh should happen immediately instead of at next interval", function(){
                        var refreshTriggered = false;
                        $(document)
                            .bind('refresh.spec', function(){
                                refreshTriggered = true;        
                            }).lifesupport(lsopts);                 

                        // after 9 units, trigger a refreshing event
                        // this is during the warning period
                        mockClock.setTimeout(function(){                        
                            $('body').trigger('testevent');
                        }, clockCycle * 9);

                        // wait until right after refreshing event triggered
                        mockWait(clockCycle * 9 + 1, function(){
                            // assert that a refresh was performed immediately
                            assert(refreshTriggered).isTrue();
                        });                                                                                
                    });
                });
            });

            describe('warning behavior', function() {
                var lsopts = {
                    events: 'fakeevent', // don't allow any refreshes to happen during warning tests
                    lifetime: 10, // don't allow any refreshes to happen during warning tests
                    warnAt: 5, // don't allow any refreshes to happen during warning tests
                    clockCycle: clockCycle,
                    window: mockWindow
                };

                before(function(){
                    $(document).lifesupport(lsopts);
                });

                describe("when warning point has not yet been met", function(){

                    it("should not have triggered [warn] event", function(){
                        var warnTriggered = false;
                        $(document).bind('warn.spec', function(){
                            warnTriggered = true;
                        });         

                        // wait until right before a warning would have occurred
                        mockWait(clockCycle * lsopts.warnAt - 1, function(){
                            assert(warnTriggered).isFalse();
                        });
                    });     

                });

                describe("when warning point is met", function() {

                    it("should trigger [warn] event exactly at warning point", function() {
                        var warnTriggered = false;
                        $(document).bind('warn.spec', function(){
                            warnTriggered = true;
                        }); 

                        // wait until right after a warn event would have occurred
                        mockWait(clockCycle * lsopts.warnAt + 1, function(){
                            assert(warnTriggered).isTrue();
                        });
                    });

                    it("should have triggerred [warn] event only once", function() {
                        var warnTriggerCount = 0;
                        $(document).bind('warn.spec', function(){
                            warnTriggerCount = 1;
                        });         

                        // 8 units past warning, ensure it only warned once
                        mockWait((lsopts.clockCycle * (lsopts.warnAt + 8)), function(){
                            assert(warnTriggerCount).equals(1);
                        });             
                    });

                });

                describe("at every second within warning period", function(){

                    it("should trigger [warningIncrement] at first second", function() {
                        var warnIncrementTriggered = false;
                        $(document).bind('warnIncrement.spec', function(){
                            warnIncrementTriggered = true;
                        });         

                        // wait until right after first warn would have occurred
                        mockWait((clockCycle * lsopts.warnAt + 1), function(){
                            assert(warnIncrementTriggered).isTrue();
                        });                                                         
                    });

                    it("should trigger [warningIncrement] at all other seconds with remaining seconds", function() {
                        var warnings = [];
                        $(document).bind('warnIncrement.spec', function(ev, remaining){
                            warnings.push(remaining);
                        });

                        // right after lifetime would have been reached
                        mockWait((clockCycle * lsopts.lifetime + 1), function(){
                            // 1 warning increment for each time unit
                            assert(warnings.length).equals(5);
                        });                 
                    });

                    it("should pass number of remaining seconds for each [warningIncrement]", function() {
                        var warnings = [];
                        $(document).bind('warnIncrement.spec', function(ev, remaining){
                            warnings.push(remaining);
                        });

                        // right after lifetime would have been reached
                        mockWait((clockCycle * lsopts.lifetime + 1), function(){
                            // 1 warning increment for each time unit
                            assert(warnings).isSameAs([5,4,3,2,1]);
                        });                 
                    });
                });
            });  

            describe('logout behavior', function(){

                describe('when [lifetime] has not yet been expended', function(){

                    var triggeredLogoutEvent, executedLogoutLambda;

                    before(function(){

                        triggeredLogoutEvent = false;
                        executedLogoutLambda = false;

                        $(document)
                            .lifesupport({
                                events: 'fakeevent',
                                lifetime: 5,
                                clockCycle: clockCycle,
                                logout: function() {
                                    executedLogoutLambda = true;                                
                                },
                                window: mockWindow                                                          
                            })
                            .bind('logout.spec', function(){
                                triggeredLogoutEvent = true;                        
                            });
                    });

                    it('should not have triggered [logout] event', function(){
                        // wait up until right before a logout should occur
                        mockWait((5 * clockCycle - 1), function(){
                            assert(triggeredLogoutEvent).isFalse();
                        });
                    });

                    it('should not have executed a [logout] lambda', function(){
                        // wait up until right before a logout should occur
                        mockWait((5 * clockCycle - 1), function(){
                            assert(executedLogoutLambda).isFalse();
                        });                                     
                    });     
                });

                describe('when [lifetime] is expended', function(){

                    it('should trigger [logout] event', function(){

                        var triggeredLogoutEvent = false;
                        $(document)
                            .lifesupport({
                                events: 'fakeevent',
                                lifetime: 5,
                                clockCycle: clockCycle,
                                window: mockWindow                          
                            })
                            .bind('logout.spec', function(){
                                triggeredLogoutEvent = true;                        
                            });

                        // wait until right after lifetime would have expired, validate event raised
                        mockWait(5 * clockCycle + 1, function(){
                            assert(triggeredLogoutEvent).isTrue();
                        });
                    });

                    describe('when [logout] option is a lambda', function(){

                        it('should call [logout] lambda', function(){
                            var logoutLambdaCalled = false;
                            $(document)
                                .lifesupport({
                                    events: 'fakeevent',
                                    lifetime: 5,
                                    clockCycle: clockCycle,
                                    logout: function(){ logoutLambdaCalled = true; },
                                    window: mockWindow
                                });

                            // wait until right after lifetime would have expired, validate lambda called
                            mockWait(5 * clockCycle + 1, function(){
                                assert(logoutLambdaCalled).isTrue();
                            });
                        }); 
                    });

                    describe('when [logout] option is a url', function(){

                        it('should call $.safetynet.suppress(true) if $.safetynet is defined', function(){
                            // set up a mock object to simulate and track window relocating                        
                            $(document)
                                .lifesupport({
                                    events: 'fakeevent',
                                    lifetime: 5,
                                    clockCycle: clockCycle,
                                    logout: 'http://test.host',
                                    window: mockWindow
                                });

                            var suppressed = false;    
                            $.safetynet = {
                                suppressed: function(val) {
                                    suppressed = val;                                
                                }
                            };

                            // wait until logout would have occurred
                            mockWait(5 * clockCycle + 1, function(){
                                // verify safetynet was suppressed
                                assert(suppressed).isTrue();
                                delete $['safetynet'];
                            });                        

                        });

                        it('should [window.relocate] to [logout] url', function(){
                            // set up a mock object to simulate and track window relocating                        
                            $(document)
                                .lifesupport({
                                    events: 'fakeevent',
                                    lifetime: 5,
                                    clockCycle: clockCycle,
                                    logout: 'http://test.host',
                                    window: mockWindow
                                });

                            // wait until logout would have occurred
                            mockWait(5 * clockCycle + 1, function(){
                                // verify that location was redirected
                                assert(mockWindow.location).equals('http://test.host');
                            });                        
                        });                     
                    });
                });           
            });                
        }); 

        describe('jQuery.lifesupport.stop', function(){
            after(resetTest);

            var lsopts = {
                events: 'fakeevent', // don't allow any refreshes to happen during warning tests
                lifetime: 10, // don't allow any refreshes to happen during warning tests
                warnAt: 5, // don't allow any refreshes to happen during warning tests
                clockCycle: clockCycle,
                window: mockWindow
            };    

            it("should stop lifesupport cycles and events", function(){
                var warnTriggered = false;
                var logoutTriggered = false;

                $(document)
                    .bind('warn.spec', function(){ warnTriggered = true; })
                    .bind('logout.spec', function(){ logoutTriggered = true; })
                    .lifesupport(lsopts);

                // set lifesupport to stop after 8 cycles (2 before a logout)
                mockClock.setTimeout(function(){
                    $.lifesupport.stop();
                }, clockCycle * 8);

                // wait until a logout would have occurred had a stop not prevented it
                mockWait(clockCycle * 15, function() {
                    // make sure the warn did occur (would have happened at 5)
                    assert(warnTriggered).isTrue();
                    // make sure logout never did (would have happened at 10 if not for stop at 8)
                    assert(logoutTriggered).isFalse();
                });
            });

            it("should reset lifesupport state", function() {           
                $(document).lifesupport(lsopts);

                // set lifesupport to stop after 8 cycles (2 before a logout)
                mockClock.setTimeout(function(){
                    $.lifesupport.stop();
                }, clockCycle * 8);

                mockWait(clockCycle * 8 + 1, function(){
                    assert($.lifesupport.timeRemaining()).equals(10);                               
                });
            });
        });

        describe('jQuery.lifesupport.refresh', function(){
            after(resetTest);

            var lsopts = {
                events: 'fakeevent', // don't allow any refreshes to happen during warning tests
                lifetime: 10, // don't allow any refreshes to happen during warning tests
                warnAt: 5, // don't allow any refreshes to happen during warning tests
                clockCycle: clockCycle,
                window: mockWindow
            };

            it("should immediately trigger a refresh event before necessary", function(){
                var refreshTriggered = false;

                $(document)
                    .bind('refresh.spec', function(){ refreshTriggered = true; })
                    .lifesupport(lsopts);

                // set lifesupport to manually refresh at 3 units (not due to raised events)
                mockClock.setTimeout(function(){
                    $.lifesupport.refresh();
                }, clockCycle * 3);

                // wait until right after a manual refresh would have occurred, and verify it
                mockWait(clockCycle * 3 + 1, function() {
                    // make sure the manual refresh occurred
                    assert(refreshTriggered).isTrue();
                });                         
            });

            it("should immediately call refresh lambda when option is lambda", function(){
                // set a lambda up to be called when refreshed
                var refreshLambdaCalled = false;            
                lsopts['refresh'] = function(){
                    refreshLambdaCalled = true;
                };

                $(document).lifesupport(lsopts);

                // set lifesupport to manually refresh at 3 units (not due to raised events)
                mockClock.setTimeout(function(){
                    $.lifesupport.refresh();
                }, clockCycle * 3);

                // wait until right after a manual refresh would have occurred, and verify it
                mockWait(clockCycle * 3 + 1, function() {
                    // make sure the manual refresh lambda called
                    assert(refreshLambdaCalled).isTrue();
                }); 
            });         

            it("should immediately make ajax request when option is url", function(){           
                // mock the ajax $.get method
                var originalGet = $.get;
                var requestedUrl = '';
                $.get = function(urlToGet) {
                    requestedUrl = urlToGet;
                };

                // set a url up to be ajax requested when refreshed
                lsopts['refresh'] = 'http://ping.url';

                // set up lifesupport
                $(document).lifesupport(lsopts);

                // set lifesupport to manually refresh at 3 units (not due to raised events)
                mockClock.setTimeout(function(){
                    $.lifesupport.refresh();
                }, clockCycle * 3);

                // wait until right after a manual refresh would have occurred, and verify it
                mockWait(clockCycle * 3 + 1, function() {
                    $.get = originalGet;
                    // make sure the manual refresh ping ajax requested against
                    assert(requestedUrl).equals('http://ping.url');
                });      
            });
        });

        describe('jQuery.lifesupport.logout', function(){
            after(resetTest);

            var lsopts = {
                events: 'fakeevent', // don't allow any refreshes to happen during warning tests
                lifetime: 10, // don't allow any refreshes to happen during warning tests
                warnAt: 5, // don't allow any refreshes to happen during warning tests
                clockCycle: clockCycle,
                window: mockWindow
            };          

            it("should immediately trigger a logout event even when not expired", function(){
                var logoutTriggered = false;

                $(document)
                    .bind('logout.spec', function(){ logoutTriggered = true; })
                    .lifesupport(lsopts);

                // set lifesupport to manually logout at 3 units (way before lifetime ending)
                mockClock.setTimeout(function(){
                    $.lifesupport.logout();
                }, clockCycle * 3);

                // wait until right after a manual logout would have occurred, and verify it
                mockWait(clockCycle * 3 + 1, function() {
                    // make sure the manual logout occurred
                    assert(logoutTriggered).isTrue();
                });             
            });

            it("should immediately call logout lambda when option is lambda", function(){
                // set a lambda up to be called when logged out
                var logoutLambdaCalled = false;             
                lsopts['logout'] = function(){
                    logoutLambdaCalled = true;
                };

                $(document).lifesupport(lsopts);

                // set lifesupport to manually logout at 3 units (way before lifetime ending)
                mockClock.setTimeout(function(){
                    $.lifesupport.logout();
                }, clockCycle * 3);

                // wait until right after a manual logout would have occurred, and verify it
                mockWait(clockCycle * 3 + 1, function() {
                    // make sure the manual logout occurred
                    assert(logoutLambdaCalled).isTrue();
                });             
            }); 

            it("should immediately redirect to logout url when option is url", function(){
                // set the url to be redirected to when logged out
                lsopts['logout'] = 'http://logout.url'

                $(document).lifesupport(lsopts);

                // set lifesupport to manually logout at 3 units (way before lifetime ending)
                mockClock.setTimeout(function(){
                    $.lifesupport.logout();
                }, clockCycle * 3);

                // wait until right after a manual logout would have occurred, and verify it
                mockWait(clockCycle * 3 + 1, function() {
                    // make sure the manual logout occurred
                    assert(mockWindow.location).equals('http://logout.url');
                });             
            });
        });

        describe('jQuery.lifesupport.timeRemaining', function(){
            after(resetTest);

            var lsopts = {
                events: 'fakeevent', // don't allow any refreshes to happen during warning tests
                lifetime: 10, // don't allow any refreshes to happen during warning tests
                warnAt: 5, // don't allow any refreshes to happen during warning tests
                clockCycle: clockCycle,
                window: mockWindow
            };          

            it("should return current number of seconds left in session", function(){
                var secondsLeftResults = [];
                $(document).lifesupport(lsopts);            

                var recordSecondsLeft = function() { 
                    secondsLeftResults.push($.lifesupport.timeRemaining());
                };              

                recordSecondsLeft();            

                mockClock.setTimeout(recordSecondsLeft, 4 * clockCycle + 1);
                mockClock.setTimeout(recordSecondsLeft, 6 * clockCycle + 1);

                mockClock.setTimeout(function(){
                    $(document).trigger('fakeevent');               
                }, 7 * clockCycle + 1)

                mockClock.setTimeout(recordSecondsLeft, 7 * clockCycle + 2);
                mockClock.setTimeout(recordSecondsLeft, 16 * clockCycle + 1);

                mockClock.advance(30 * clockCycle);

                assert(secondsLeftResults).isSameAs([10,6,4,10,1]);
            });
        });            
    };
    
    /**
     * naive replication of $.each since 
     * jquery is not defined at this point
     */
    var each = function(items, fn) {
        for(var i=0;i<items.length;i++) {
            var item = items[i];
            fn(item);
        };
    };
    
    /**
     * run entire test suite against multiple loaded versions
     * of jquery.
     * 
     * Assumes they have each been loaded and set to notConflict(true)
     * aliased as jq14, jq13, etc.
     */
    each(["1.3.2","1.4.1","1.4.2"], function(version) {
        describe("in jQ " + version, function(){
            $ = jQuery = window['jq_' + version.replace(/\./g,'_')];
            specification();                    
        });        
    });        
});
