var config = require("./config.json");
var url = require('url');
var https = require('https');
var querystring = require('querystring');
var Q = require("q");
var entities = require('entities');
var yaml = require("yaml");
var util = require("util");

var session = null;

var InvalidTokenError = function(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
};
InvalidTokenError.prototype = Error.prototype;

var extend = function(obj1, obj2) {
    for(var property in obj2) {
        if(obj2.hasOwnProperty(property)) {
            obj1[property] = obj2[property];
        }
    }
    return obj1;
};

var request = function(urlstr, headers, params, data) {
    var url_parsed = url.parse(urlstr);
    var method = data !== undefined ? "POST" : "GET", body = "";
    var options = {
        "method": method,
        "port": url_parsed.port,
        "hostname": url_parsed.hostname,
        "path": url_parsed.path + (params !== undefined ? "?" + querystring.stringify(params) : ""),
        "auth": url_parsed.auth,
        "headers": extend({
            "User-Agent": "ghs/1.1.0"
        }, headers)
    };
    if(method === "POST") {
        body = querystring.stringify(data);
        options.headers = extend(options.headers, {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": body.length,
        });
    }
    return Q.Promise(function(resolve, reject){
        var req = https.request(options, function(res) {
            var response = "";
            // console.log('STATUS: ' + res.statusCode);
            // console.log('HEADERS: ' + JSON.stringify(res.headers));
            res.on('data', function (chunk) {
                response += chunk;
                // console.log('BODY: ' + chunk);
            }).on('end', function (chunk) {
                if(res.statusCode == 200) {
                    res.json = JSON.parse(response);
                    resolve(res);
                } else if(res.statusCode == 401) {
                    reject(new InvalidTokenError("invalid token"));
                } else {
                    reject(new Error("unexpected status " + res.statusCode));
                }
            });
        }).on('error', function(e) {
            reject(new Error("post: " + e.message));
        });
        req.write(body);
        req.end();
    });
};

var get = function(url, params) {
    return request(url, {
        "Authorization": session.token_type + " " + session.access_token
    }, params);
};

var post = function(url, params, data) {
    return request(url, {
        "Authorization": session.token_type + " " + session.access_token
    }, params, data);
};

var login = function() {
    var url = util.format("https://%s:%s@ssl.reddit.com/api/v1/access_token", config.reddit.consumer_key, config.reddit.consumer_secret);
    var scopes = ["identity", "wikiread", "modconfig"];
    return request(url, {}, {}, {
        "grant_type": "password",
        "username": config.reddit.username,
        "password": config.reddit.password,
        "scope": scopes.join(",")
    }).then(function(response) {
        if(response.statusCode == 200) {
            // save the token
            session = extend({}, response.json);
        }
        return response;
    });
};

/* Inspired by qretry */
var access_token = function(fn) {
    var result = Q.fcall(fn);
    return result.fail(function(err){
        if(err instanceof InvalidTokenError) {
            // Wait 1 second before trying getting a new token and then retry once
            return Q.delay(1000).then(function(){
                return login();
            }).then(function(){
                return Q.fcall(fn);
            });
        }
    });
};

var template = function() {
    return get("https://oauth.reddit.com/r/" + config.reddit.subreddit.name + "/wiki/sidebar");
};

var settings = function() {
    return get("https://oauth.reddit.com/r/" + config.reddit.subreddit.name + "/about/edit.json");
};

var update = function(events, template, settings) {
    var description = entities.decodeHTML(template.data.content_md).replace(/{{events}}/, format(events));
    return access_token(function(){
        return post("https://oauth.reddit.com/api/site_admin", {}, {
            allow_top: true,
            api_type: "json",
            comment_score_hide_mins: settings.data.comment_score_hide_mins,
            css_on_cname: settings.data.domain_css,
            description: description,
            exclude_banned_modqueue: settings.data.exclude_banned_modqueue,
            "header-title": settings.data.title,
            lang: settings.data.language,
            link_type: settings.data.content_options,
            name: config.reddit.subreddit.name,
            over_18: settings.data.over_18,
            public_description: settings.data.public_description,
            public_traffic: settings.data.public_traffic,
            show_cname_sidebar: settings.data.domain_sidebar,
            show_media: settings.data.show_media,
            spam_comments: settings.data.spam_comments,
            spam_links: settings.data.spam_links,
            spam_selfposts: settings.data.spam_selfposts,
            sr: config.reddit.subreddit.id,
            submit_link_label: settings.data.submit_link_label,
            submit_text: settings.data.submit_text,
            submit_text_label: settings.data.submit_text_label,
            title: settings.data.title,
            type: settings.data.subreddit_type,
            wiki_edit_age: settings.data.wiki_edit_age,
            wiki_edit_karma: settings.data.wiki_edit_karma,
            wikimode: settings.data.wikimode
        });
    });
};

var format = function(data) {
    var now = new Date();
    var formatted = "";
    data.items.forEach(function(item){
        var start = new Date(item.start.dateTime);
        var diff =  (start.getTime() - now.getTime()) / 1000;
        var description = {};

        if(item.description) {
            try {
                // Add a newline at the end to make the yaml module happy
                description = yaml.eval(item.description + "\n");
            } catch (error) {
                throw new Error("yaml: " + error.message);
            }
        }

        /* Assume any event with less than a minute remaining as LIVE */
        if(diff >= 60) {
            var days = Math.floor(diff / 86400);
            var hours = Math.floor((diff % 86400) / 3600);
            var minutes = Math.floor((diff % 3600) / 60);

            formatted += "*";
            if(days) formatted += " " + days + "d";
            if(hours) formatted += " " + hours + "h";
            if(minutes) formatted += " " + minutes + "m";
            formatted += "  ";
        } else {
            formatted += "* [**LIVE**](#live)  ";
        }

        formatted += "\n  ";
        if(description.type) {
            if(description.type == "show") {
                /* There's no icon for shows */
            }
            else if(description.type == "podcast") {
                formatted += "[♫] ";
            }
            else /*if(description.type == "tournament")*/ {
                formatted += "[♛] ";
            }
        } else {
            formatted += "[♛] ";
        }
        
        if(item.location) {
            formatted += "**[" + item.summary + "](" + item.location + ")**";
        } else {
            formatted += "**" + item.summary + "**";
        }

        if(description.description) {
            formatted += "  \n  " + description.description;
        }
        formatted += "\n\n";
    });

    return formatted;
};

var upcoming = function() {
    return request("https://www.googleapis.com/calendar/v3/calendars/" + config.google.calendar + "/events", {}, {
        maxResults: 5,
        orderBy: "startTime",
        singleEvents: true,
        fields: "items(location,start,summary,description),summary",
        timeMin: new Date().toISOString(),
        key: config.google.token
    });
};

(function run(){
    console.log("updating sidebar");
    upcoming().then(function(events){
        return access_token(function(){
            return Q.all([ Q(events), template(), settings() ]);
        });
    }).spread(function(evt, tpl, cfg){
        return update(evt.json, tpl.json, cfg.json);
    }).then(function(){
        console.log("sidebar updated");
    }).catch(function(err){
        console.error(err);
    }).finally(function(){
        console.log("sleeping for 1 minute");
        setTimeout(run, 60000);
    });
})();
