$(function() {
    var $calendar = $('#calendar'), $types = $(".type-selector"), ctz = false;

    var query = function() {
        var q = {}, parts = window.location.search.substring(1).split("&"), decode = function(s){
            return decodeURIComponent(s.replace(/\+/g, " "));
        };
        for(var i = 0; i < parts.length; ++i) {
            var components = parts[i].split("=");
            if((components.length == 2) && (components[0].length)) {
                q[decode(components[0])] = decode(components[1]);
            }
        }
        return q;
    };

    var tz = function() {
        var $tz = $('#timezone-selector'), q = query(), qtz = q["tz"] || false, timeZones = [
            "Europe/Brussels",
            "America/Los_Angeles",
            "America/Toronto",
            "Asia/Seoul"
        ];
        
        if($.inArray(qtz, timeZones) != -1) {
            ctz = qtz;
            $tz.val(ctz);
        }
        
        $tz.on('change', function() {
            ctz = this.value || false;
            $calendar.fullCalendar('destroy');
            render();
        });

        console.log("qtz: " + qtz + ", ctz: " + ctz);
    };

    var render = function() {
        var visible = {
            "tournament": $types.is("[name=T]:checked"),
            "show": $types.is("[name=S]:checked"),
            "podcast": $types.is("[name=P]:checked")
        };
        console.log("visible: ", visible);
        $calendar.fullCalendar({
            "header": {
                "left": 'today prev,next',
                "center": 'title',
                "right": 'month,agendaWeek,agendaDay'
            },
            "editable": false,
            "eventLimit": true,
            "events": "https://www.google.com/calendar/feeds/9i04ng25vjhr5t59j4jbuflcf0%40group.calendar.google.com/public/basic",
            "eventRender": function(event, element) {
                var $element = $(element);
                try {
                    var evt = jsyaml.safeLoad(event.description), type = "tournament";
                    if(evt.hasOwnProperty("type") && evt.type) {
                        type = evt.type;
                    }
                    if(visible.hasOwnProperty(type) && visible[type]) {
                        $element.addClass(type);
                    } else {
                        return false;
                    }
                } catch (e) {
                    return false;
                }
            },
            "height": $(window.top).height() - 100,
            "timezone": ctz
        });
    };

    $types.on("change", function(){
        $calendar.fullCalendar('destroy');
        render();
    });

    var init = function() {
        tz();
        render();
    };

    init();
});
