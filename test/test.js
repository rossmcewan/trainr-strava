'use strict';

var baseRequest = {
  access_token: 'e55e103f02dd289016c7b62fdbb64dde0b6761fd'
}

var _ = require('lodash');
var math = require('mathjs');
var strava = require('strava-v3');
var moment = require('moment');

var assert = require('assert');
var TrainrStrava = require('../index');

function getValue(mathval) {
  return JSON.parse(JSON.stringify(mathval)).value;
}

describe('trainr-strava node module', function () {
  it('should get athlete history', function (done) {
    return strava.athlete.get(baseRequest, function (error, athlete) {
      console.log(athlete);
      if (error) return done(error);
      var numWeeks = 6;
      var from = moment().day(1).subtract(numWeeks, 'weeks').format('X');
      var to = moment().format('X');
      var request = _.extend({}, baseRequest);
      request.before = to;
      request.after = from;
      request.per_page = 100;
      return strava.athlete.listActivities(request, function (error, activities) {
        if (error) return done(error);
        activities = activities.filter(function (item) {
          return item.type == 'Run';
        })
        var sorted = _.sortBy(activities, function (item) {
          return moment(item.start_date);
        });
        var earliest = _.first(sorted);
        var latest = _.last(sorted);
        var start = moment(earliest.start_date_local);
        var end = moment(latest.start_date_local);
        numWeeks = end.diff(start, 'weeks');
        console.log('Weeks : ', numWeeks);
        var count = sorted.length;
        var byWeek = _.groupBy(sorted, function (item) {
          return moment(item.start_date_local).week().toString();
        })
        var weeklySummary = _.mapValues(byWeek, function (runs) {
          var count = runs.length;
          var totalDistance = getValue(math.eval(_.sum(runs, 'distance') + ' ' + athlete.measurement_preference + ' in meters'));
          var averageDistance = totalDistance / count;
          var longestRun = _.max(runs, 'distance');
          var hasLongRun = true;
          if ((longestRun.distance < (averageDistance * 1.5)) || (longestRun.distance < totalDistance / 5)) {
            hasLongRun = false;
          }
          var runDays = _.map(runs, function (run) {
            return moment(run.start_date_local).day()
          })
          return {
            count: count,
            totalDistance: getValue(math.eval(totalDistance + ' meters in km')),
            averageDistance: getValue(math.eval(averageDistance + ' meters in km')),
            longest: getValue(math.eval(longestRun.distance + ' meters in km')),
            longestDay: hasLongRun ? moment(longestRun.start_date_local).day() : undefined,
            runDays: runDays
          };
        });

        var longRunDays = [];
        var runDays = [];
        for (var prop in weeklySummary) {
          var ws = weeklySummary[prop];
          ws.runDays.forEach(function (rd) {
            var runDay = _.findWhere(runDays, { day: rd });
            if (runDay) {
              runDay.count++;
            } else {
              runDay = {
                day: rd,
                count: 1
              }
              runDays.push(runDay);
            }
          });
          if (ws.longestDay != undefined) {
            var longestDay = _.findWhere(longRunDays, { day: ws.longestDay });
            if (longestDay) {
              longestDay.count++;
            } else {
              longestDay = {
                day: ws.longestDay,
                count: 1
              }
              longRunDays.push(longestDay);
            }
          }
        }
        var count = _.sum(weeklySummary, 'count');
        var totalDistance = _.sum(weeklySummary, 'totalDistance');
        var averageDistance = totalDistance / count;
        var longest = _.max(weeklySummary, 'longest').longest;
        var races = activities.filter(function (item) {
          return item.workout_type == 1;
        });
        var longRuns = activities.filter(function (item) {
          return item.workout_type == 2;
        });
        longRuns.forEach(function (item) {
          var day = moment(item.start_date_local).day();
          var longestDay = _.findWhere(longRunDays, { day: day });
          if (!longestDay) {
            longRunDays.push({
              day: day,
              count: 1
            });
          }
        })
        var workoutDays = [];
        var workouts = activities.filter(function (item) {
          return item.workout_type == 3;
        });
        workouts.forEach(function (item) {
          var day = moment(item.start_date_local).day();
          var workoutDay = _.findWhere(workoutDays, { day: day });
          if (workoutDay) {
            workoutDay.count++;
          } else {
            workoutDays.push({
              day: day,
              count: 1
            });
          }
        });
        var vdots = [];
        var Calculator = TrainrStrava.Calculator;
        activities.forEach(function (item) {
          var distance = getValue(math.eval(item.distance + ' meters in km'));
          var duration = moment.duration(item.elapsed_time * 1000);
          var calculator = new Calculator({
            distance: distance,
            hours: duration.hours(),
            minutes: duration.minutes(),
            seconds: duration.seconds()
          });
          var vdot = calculator.calculate(distance, duration.hours(), duration.minutes(), duration.seconds());
          vdots.push({
            activity: item,
            vdot: vdot
          });
        });
        var maxVdot = _.max(vdots, 'vdot');
        var vdot = maxVdot.vdot;
        var duration = moment.duration(maxVdot.activity.elapsed_time * 1000);
        var calculator = new Calculator({
          distance: getValue(math.eval(maxVdot.activity.distance + ' meters in km')),
          hours: duration.hours(),
          minutes: duration.minutes(),
          seconds: duration.seconds()
        });
        var periodSummary = {
          count: count,
          averageCountPerWeek: count / numWeeks,
          totalDistance: totalDistance,
          averageDistancePerWeek: totalDistance / numWeeks,
          averageDistancePerRun: averageDistance,
          longest: longest,
          runDays: _.sortBy(runDays, 'count').reverse(),
          longRunDays: _.sortBy(longRunDays, 'count').reverse(),
          workoutDays: _.sortBy(workoutDays, 'count').reverse(),
          bestVdot: vdot,
          easy: calculator.easy(vdot),
          tempo: calculator.tempo(vdot),
          interval: calculator.interval(vdot),
          repetition: calculator.repetition(vdot),
          recovery: calculator.recovery(vdot),
          marathon: calculator.marathon(vdot)
        };

        console.log('Number of races: ', races.length);
        console.log('Number of long runs: ', longRuns.length);
        console.log('Number of workouts: ', workouts.length);

        //console.log('Athlete: ', athlete);
        console.log('Weekly Summary: ', weeklySummary);
        console.log('Period Summary: ', periodSummary);
        // console.log(workouts);
        // console.log(longRuns);
        //get long run days (i.e. which day of the week the longest runs were done on, weight by popularity)
        //get days of the week that were most often run on (weight by popularity)
        
        var programAthlete = {
          "name": athlete.firstname + ' ' + athlete.lastname,
          "weight": athlete.weight,
          "runner": {
            "tests": [
              {
                "VDOT": maxVdot.vdot,
                "distance": maxVdot.activity.distance,
                "date": maxVdot.activity.start_date_local
              }
            ],
            "paces": {
              "endurancePace": periodSummary.easy / 60,
              "intervalPace": periodSummary.interval / 60,
              "repetitionPace": periodSummary.repetition / 60,
              "marathonPace": periodSummary.marathon / 60,
              "thresholdPace": periodSummary.tempo / 60
            },
            "maxWeeklyDistance": 80000,//periodSummary.averageDistancePerWeek * 1.5 * 1000,
            "shortestEasyRun": 5000,
            "longestEasyRun": 10000,// periodSummary.averageDistancePerRun * 1.5 * 1000,
            "qualityDays": {
              "Q1": 2,
              "Q2": 4,
              "Q3": 6
            },
            "trainingDays": {
              "0": false,
              "1": true,
              "2": true,
              "3": true,
              "4": false,
              "5": true,
              "6": true
            }
          }
        }
        console.log(programAthlete);
        var fs = require('fs');
        var fileName = programAthlete.name.replace(' ', '') + '.program';
        TrainrStrava.generator.createProgram(programAthlete, { rules: require('../models/21and42.json') }, function (error, result) {
          fs.writeFileSync(fileName+'.json', JSON.stringify(result));
          fs.writeFileSync(fileName, programAthlete.name);
          fs.appendFileSync(fileName, '\n');
          fs.appendFileSync(fileName, programAthlete.runner.tests[0].VDOT);
          fs.appendFileSync(fileName, '\n');
          fs.appendFileSync(fileName, (programAthlete.runner.maxWeeklyDistance / 1000) + 'km');
          fs.appendFileSync(fileName, '\n');
          fs.appendFileSync(fileName, '\n==========================================================================\n');
          for (var x = 0; x < result.weeks.length; x++) {
            var week = result.weeks[x];
            fs.appendFileSync(fileName, 'WEEK ' + week.weekNumber);
            fs.appendFileSync(fileName, '\nPercentage of Max: ' + (week.percentageOfMax * 100) + '%')
            fs.appendFileSync(fileName, '\nWeek Distance Goal: ' + week.weekDistance / 1000 + 'km')
            fs.appendFileSync(fileName, '\nAdditional Distance to run: ' + week.difference / 1000 + 'km')
            fs.appendFileSync(fileName, '\n==========================================================================\n');
            for (var y = 0; y < week.days.length; y++) {
              var day = week.days[y];
              if (!day.sessions || day.sessions.length == 0) continue;
              fs.appendFileSync(fileName, day.name);
              fs.appendFileSync(fileName, '\n------------------------------------------------------------------------\n');
              for (var z = 0; z < day.sessions.length; z++) {
                var session = day.sessions[z];
                if (session) {
                  fs.appendFileSync(fileName, session.description);
                }
                fs.appendFileSync(fileName, '\n');
              }
            }
            fs.appendFileSync(fileName, '==========================================================================\n')
          }
          return done();
        });
      })
    });
  });
});

