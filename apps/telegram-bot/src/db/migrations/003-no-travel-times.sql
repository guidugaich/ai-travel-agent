-- Travel time to the airport is never estimated (decision D13), so nothing stores it.
alter table users drop column transit_airport_minutes, drop column transit_other_minutes;
alter table events drop column transit_minutes;
