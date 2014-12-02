#!/usr/bin/python
# -*- coding: utf-8 -*-

import praw
import requests
import time
import calendar
import yaml

subreddit_name = ""
calendar_id = ""
calendar_key = ""

def now():
  return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def events():
  r = requests.get("https://www.googleapis.com/calendar/v3/calendars/" + calendar_id + "/events", params={
    "maxResults": 5,
    "orderBy": "startTime",
    "singleEvents": "true",
    "fields": "items(location,start,summary,description),summary",
    "timeMin": now(),
    "key": calendar_key
  })
  
  for item in r.json()["items"]:
    yield item

def timestamp(event):
  timestamp
  current_time = time.time()
  event_time = calendar.timegm(time.strptime(event["start"]["dateTime"], "%Y-%m-%dT%H:%M:%SZ"))

  if current_time >= event_time - 60:
    return "[**LIVE**](#live)"
  else:
    def format_segment(number, suffix=""):
      return "%d%s" % (number, suffix) if number else ""

    time_diff = event_time - current_time
    days = time_diff // 86400
    hours = (time_diff % 86400) // 3600
    minutes = (time_diff % 3600) // 60

    return " ".join([format_segment(days, "d"), format_segment(hours, "h"), format_segment(minutes, "m")]).strip()

def name(event):
  name_md = u""
  properties = {}

  if "description" in event:
    properties = yaml.safe_load(event["description"])

  # Show the icon depending on the type of the event
  event_type = properties.get("type", "show")
  if event_type == "show":
    pass
  elif event_type == "show":
    name_md += u"[♫] "
  else:
    name_md += u"[♛] ";

  # Event name
  if "location" in event:
    name_md += "**[" + event["summary"] + "](" + event["location"] + ")**"
  else:
    name_md += "**" + event["summary"] + "**"

  # Tagline
  if "description" in properties:
    name_md += "  \n  %s" % (properties["description"])
  
  return name_md

r = praw.Reddit(user_agent="ghs/2.0", site_name="oauth")
r.login()

while True:
  print "fetching calendar data"
  events_md = ""
  for event in events():
    events_md += "* %s  \n  %s\n\n" % (timestamp(event), name(event))

  print "fetching sidebar template"
  subreddit = r.get_subreddit(subreddit_name)
  template_md = subreddit.get_wiki_page("sidebar").content_md

  print "updating sidebar"
  sidebar_md = template_md.replace("{{events}}", events_md)
  subreddit.edit_wiki_page("config/sidebar", sidebar_md)

  print "sleeping for 60 seconds"
  time.sleep(60)
