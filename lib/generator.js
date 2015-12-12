'use strict';

var _ = require('lodash');
var moment = require('moment');

module.exports = {
	createProgram:function(athlete, options, callback){
		var rules = options.rules;
		var result = {
			weeks:[]
		};
		var totalWeeks = 0;
		rules.phases.forEach(function(phase){
			totalWeeks += phase.duration;
		})
		var weekNumber = 0;
		rules.phases.forEach(function(phase){
			for(var x = 0;x<phase.duration; x++){
				weekNumber++;
				var distanceForWeek = (phase.percentageOfMaxPerWeek[x] * athlete.runner.maxWeeklyDistance);
				var week = {
					weekNumber:weekNumber,	
					weekDistance:distanceForWeek,
					percentageOfMax:phase.percentageOfMaxPerWeek[x],				
					days:[
						{name:'Monday', sessions:[]},
						{name:'Tuesday', sessions:[]},
						{name:'Wednesday', sessions:[]},
						{name:'Thursday', sessions:[]},
						{name:'Friday', sessions:[]},
						{name:'Saturday', sessions:[]},
						{name:'Sunday', sessions:[]}]
				};
				phase.qualitySessions.forEach(function(qs){
					var qday = athlete.runner.qualityDays[qs.name];
					var qsession = createSession(athlete, qs, {weekNumber:weekNumber, totalWeeks:totalWeeks, percentageOfWeeklyDistance:phase.percentageOfMaxPerWeek[x]});					
					if(qsession){
						qsession.weekNumber = weekNumber;
						if(qsession.shouldWarmup){
							qsession.warmup = {
								duration:15,
								pace:athlete.runner.paces.endurancePace,
								distance:(15/athlete.runner.paces.endurancePace*1000)
							}
						}
						if(qsession.shouldCooldown){
							qsession.cooldown = {
								duration:10,
								pace:athlete.runner.paces.endurancePace,
								distance:(10/athlete.runner.paces.endurancePace*1000)
							}
						}										
					}
					var day = week.days[qday];
					if(qsession)
						day.sessions.push(qsession);
				})
				fillWeek(athlete, week, {percentageOfWeeklyDistance:phase.percentageOfMaxPerWeek[x]});
				result.weeks.push(week);
			}
		})
		setDescriptions(result);
		callback(undefined, result);
	}
}

function setDescriptions(result){
	_.each(result.weeks, function(week){
		_.each(week.days, function(day){
			_.each(day.sessions, function(qsession){
				qsession.description = '';
				qsession.description += 'Total Distance: ' + stringifyDistance(qsession.distance) + "\n";
				if(qsession.warmup){
					qsession.description += "WARMUP\n";
					qsession.description += qsession.warmup.duration + " min at " + stringifyTime(qsession.warmup.pace) + " min per km\n";
					qsession.description += "MAIN SET\n";
				}
				for(var i=0;i<qsession.sets.length;i++){
					var set = qsession.sets[i];
					if(set && set.intervals && set.intervals.length){
						if(set.intervals[0].distance)
							qsession.description += (set.intervals.length>1?(set.intervals.length + " x "):"") + stringifyDistance(set.intervals[0].distance) + " at " + stringifyTime(set.intervals[0].pace) + " min per km\n";
						if(set.intervals[0].duration)
							qsession.description += (set.intervals.length>1?(set.intervals.length + " x "):"") + stringifyTime(set.intervals[0].duration) + " at " + stringifyTime(set.intervals[0].pace) + " min per km\n";
						if(set.intervals[0].recovery)
							qsession.description += getRecoveryDescription(set.intervals[0].recovery) + "\n";
					}
				}
				if(qsession.cooldown){
					qsession.description += "COOL DOWN\n";
					qsession.description += qsession.cooldown.duration + " min at " + stringifyTime(qsession.cooldown.pace) + " min per km\n";	
				}
			})
		})
	})	
}

function stringifyDistance(distance){
	if(!distance) return '0km';
	if(distance > 1000){
		return (distance/1000).toFixed(2) + "km";
	}
	return distance.toFixed(0) + "m";
}

function stringifyTime(pace){
	var dec = pace % 1;
	var secs = parseInt(dec * 60).toString();
	var main = Math.floor(pace);
	var pad = '00';
	if(main > 60){
		var hm = main/60;
		var h = Math.floor(hm);
		var m = parseInt((hm%1)*60);
		m = parseInt(15*Math.round(m/15))
		if(m>=60){
			h++;
			m = 0;
		}
		m = m.toString();		
		return h + ':' + pad.substring(0, pad.length-m.length) + m + ':00';
	}
	return main + ':' + pad.substring(0,pad.length-secs.length)+secs;
}

function fillWeek(athlete, week, options){
	console.log('WEEK ' + week.weekNumber);
	var noTrainingDays = [];
	var multiDays = [];
	//first, get the total distance run for all the sessions
	var totalDistance = 0;
	for(var x=0;x<week.days.length;x++){		
		var day = week.days[x];
		//day.distance = 0;
		if(day.sessions.length == 0){
			//there is no training on this day - is it allowed
			if(athlete.runner.trainingDays[x] === true){
				var dayIndex = x;
				noTrainingDays.push(dayIndex);
			}
			if(athlete.runner.multiSessionDays && athlete.runner.multiSessionDays[x] > 1){
				var dayIndex = x;
				multiDays.push({day:dayIndex, numberOfSessions:athlete.runner.multiSessionDays[x]})
			}
		}
		for(var y=0;y<day.sessions.length;y++){			
			var session = day.sessions[y];		
			var sessionDistance = (session.totalDistance + (session.warmup?session.warmup.distance:0) + (session.cooldown?session.cooldown.distance:0));
			session.distance = sessionDistance;
			totalDistance = totalDistance + sessionDistance;			
		}
	}

	//then get total km's runner should be running this week using options.percentageOfWeeklyDistance * athlete.maxWeeklyDistance
	var totalAllowedDistance = athlete.runner.maxWeeklyDistance * options.percentageOfWeeklyDistance;

	//get the difference between and spread over any days without any sessions first that the athlete can train on
	//have an upper threshold for a session (possibly provided by the athlete) and split to multi-session days

	var difference = (totalAllowedDistance - totalDistance);

	week.difference = parseInt(5000*Math.round(difference/5000));
	// return;
	
	//what days have no training on them and can be trained on
	if(difference <= athlete.runner.shortestEasyRun){
		if(noTrainingDays.length > 0){			
		//get the first free day
			var firstFreeDay = week.days[noTrainingDays[0]]
			firstFreeDay.sessions.push({
				type:'Endurance',
				sets:[{
					distance:athlete.runner.shortestEasyRun,
					pace:athlete.runner.paces.endurancePace
				}],
				distance:athlete.runner.shortestEasyRun
			})
		}else{
			//how do the multi days look
			if(multiDays.length > 0){
				//get the first available one
				for(var m=0;m<multiDays.length;m++){
					var multiDay = multiDays[m];
					var matching = week.days[multiDay.day];
					var sessionsOnMatching = matching.sessions.length;
					if(sessionsOnMatching < multiDay.numberOfSessions){
						//there is room
						matching.sessions.push({
							type:'Endurance',
							sets:[{
								// intervals:[{
									distance:athlete.runner.shortestEasyRun,
									pace:athlete.runner.paces.endurancePace
								// }]
							}],
							distance:athlete.runner.shortestEasyRun
						})
					}
				}
			}
		}		
	}else{
		if(noTrainingDays.length > 0){
			var numberOfFreeDays = noTrainingDays.length;
			var equalSplit = difference/numberOfFreeDays;
			if(equalSplit >= athlete.runner.shortestEasyRun){// && equalSplit <= athlete.runner.longestEasyRun){
				//allocate one to each day
				for(var t=0;t<noTrainingDays.length;t++){
					var day = week.days[noTrainingDays[t]];
					day.sessions.push({
						type:'Endurance',
						sets:[{
							intervals:[{
								distance:parseInt(500*Math.round(equalSplit/500)),
								pace:athlete.runner.paces.endurancePace
							}]
						}
						],
						distance:parseInt(500*Math.round(equalSplit/500))
					})
				}
			}else{
				if(noTrainingDays.length > 1){
					var numberOfFreeDays = noTrainingDays.length/2;
					var equalSplit = difference/numberOfFreeDays;
					if(equalSplit >= athlete.runner.shortestEasyRun){// && equalSplit <= athlete.runner.longestEasyRun){
						//allocate one to each day
						for(var t=0;t<noTrainingDays.length;t++){
							var day = week.days[noTrainingDays[t]];
							day.sessions.push({
								type:'Endurance',
								sets:[{
									intervals:[{
										distance:parseInt(500*Math.round(equalSplit/500)),
										pace:athlete.runner.paces.endurancePace
									}]
								}
								],
								distance:parseInt(500*Math.round(equalSplit/500))
							})							
						}
					}else{
						//hmmm. this didn't work. try a run half way between max and min
						var halfWay = (athlete.runner.shortestEasyRun + athlete.runner.longestEasyRun)/2;
						if(difference > halfWay){
							//in this instance - allocate the halfway distance and refill
							var firstFreeDay = week.days[noTrainingDays[0]]
							firstFreeDay.sessions.push({
								type:'Endurance',
								sets:[{
									intervals:[{
										distance:parseInt(500*Math.round(halfWay/500)),
										pace:athlete.runner.paces.endurancePace
									}]
								}
								],
								distance:parseInt(500*Math.round(halfWay/500))
							})
							return fillWeek(athlete, week, options)
						}else{
							//just add it
							var firstFreeDay = week.days[noTrainingDays[0]]
							firstFreeDay.sessions.push({
								type:'Endurance',
								sets:[{
									intervals:[{
										distance:parseInt(500*Math.round(difference/500)),
										pace:athlete.runner.paces.endurancePace
									}]
								}
								],
								distance:parseInt(500*Math.round(difference/500))
							})
						}
					}
				}else{
					if(multiDays.length > 0){

					}
				}				
			}
		}
	}
}

function createSession(athlete, session, options){	
	var returnSession = {focus:[],sets:[],totalDistance:0};
	for(var i=0;i<session.focus.length;i++){
		returnSession.focus.push(session.focus[i]);
		var s = undefined;		
		options.weighting = session.focus[i].weighting;
		switch(session.focus[i].name){
			case "R":				
				s = createRepetitionSession(athlete, session, options);
				break;
			case "I":
				s = createIntervalSession(athlete, session, options);
				break;
			case "T":
				s = createThresholdSession(athlete, session, options);
				break;
			case "E":
				s = createEnduranceSession(athlete, session, options);
				break;
			case "M":
				s = createMarathonSession(athlete, session, options);
				break;
			case "LT":
				s = createLongThresholdSession(athlete, session, options);
				break;
			case "H":
				s = createHillSession(athlete, session, options);
				break;
			case "L":
				s = createLongSession(athlete, session, options);
				break;				
		}
		if(s){
			for(var x=0;x<s.sets.length;x++){
				returnSession.sets.push(s.sets[x]);
			}
			returnSession.totalDistance += s.totalDistance;
		}		
	}
	returnSession.shouldWarmup = session.shouldWarmup;
	returnSession.shouldCooldown = session.shouldCooldown;
	return returnSession;
}

function randomIntFromInterval(min,max){
    return Math.floor(Math.random()*(max-min+1)+min);
}

function createRepetitionSession(athlete, session, options){
	var repetition = require('../models/repetition-pace.json');
	var totalDistance = athlete.runner.maxWeeklyDistance;
	var weekRatio = options.percentageOfWeeklyDistance;
	var totalRepDistance = totalDistance*repetition.maxPercentageOfWeeklyDistance*weekRatio*options.weighting;
	var distances = repetition.distances;
	var index = randomIntFromInterval(0,distances.length-1);	
	var repDistance = distances[index];
	var numberOfReps = Math.round(totalRepDistance/repDistance);

	var session = {
		type:'Repetition',
		sets:[],
		totalDistance:totalRepDistance
	}
	
	var iterations = 1;
	if(numberOfReps > 10){
		//then split into 2 sets
		numberOfReps = (numberOfReps/2);
		iterations = 2;
	}
	for(var i=0;i<iterations;i++){
		var set = {};		
		set.intervals = [];
		for(var x=0;x<numberOfReps;x++){
			set.intervals.push({
				distance:repDistance,
				pace:athlete.runner.paces.repetitionPace,
				recovery:repetition.recovery
			})
		}
		session.sets.push(set);
		if(iterations == 2){
			session.sets.push({
				intervals:[
					{
						duration:(numberOfReps*repDistance/1000*athlete.runner.paces.repetition),
						pace:athlete.runner.paces.endurancePace	
					}
				]
			})
		}
	}
	
	return session;
}

function getRecoveryDescription(recovery){
	switch(recovery){
		case "untilFresh":
			return "Recovery until fresh in between intervals";
		case "oneMinutePerFiveMinute":
			return "Recover one minute for each five minutes of interval";
		case "equalToOrLessThan":
			return "Recovery time should equal to or less than interval time";
	}
}

function createIntervalSession(athlete, session, options){
	var interval = require('../models/interval-pace.json');
	var totalDistance = athlete.runner.maxWeeklyDistance;
	var weekRatio = options.percentageOfWeeklyDistance;
	var totalIntervalDistance = totalDistance*weekRatio*interval.maxPercentageOfWeeklyDistance*options.weighting;
	var durations = interval.durations;
	var index = randomIntFromInterval(0,durations.length-1);
	var intervalDuration = durations[index];

	var ratio = intervalDuration/athlete.runner.paces.intervalPace;
	var intervalDistance = 1000*ratio;

	var numberOfReps = Math.round(totalIntervalDistance/intervalDistance);

	var session = {
		type:'Interval',
		sets:[],
		totalDistance:totalIntervalDistance
	}
	
	var iterations = 1;
	if(numberOfReps > 6){
		//then split into 2 sets
		numberOfReps = (numberOfReps/2);
		iterations = 2;
	}
	for(var i=0;i<iterations;i++){
		var set = {};		
		set.intervals = [];
		for(var x=0;x<numberOfReps;x++){
			set.intervals.push({
				duration:intervalDuration,
				pace:athlete.runner.paces.intervalPace,
				recovery:interval.recovery
			})
		}
		session.sets.push(set);
		if(iterations == 2){
			session.sets.push({
				intervals:[
					{
						duration:(numberOfReps*intervalDistance/1000*athlete.runner.paces.repetition),
						pace:athlete.runner.paces.endurancePace	
					}
				]
			})
		}
	}
	return session;
}

function createThresholdSession(athlete, session, options){
	var threshold = require('../models/threshold-pace.json');
	var totalDistance = athlete.runner.maxWeeklyDistance;
	var weekRatio = options.percentageOfWeeklyDistance;
	var totalIntervalDistance = totalDistance*weekRatio*threshold.maxPercentageOfWeeklyDistance*options.weighting;
	var durations = threshold.durations;
	var index = randomIntFromInterval(0,durations.length-1);
	var intervalDuration = durations[index];

	var ratio = intervalDuration/athlete.runner.paces.thresholdPace;
	var intervalDistance = 1000*ratio;

	var numberOfReps = Math.round(totalIntervalDistance/intervalDistance);

	var session = {
		type:'Threshold',
		sets:[],
		totalDistance:totalIntervalDistance
	}
	
	var iterations = 1;
	
	for(var i=0;i<iterations;i++){
		var set = {};		
		set.intervals = [];
		for(var x=0;x<numberOfReps;x++){
			set.intervals.push({
				duration:intervalDuration,
				pace:athlete.runner.paces.thresholdPace,
				recovery:threshold.recovery
			})
		}
		session.sets.push(set);
	}
	return session;
}

function createEnduranceSession(athlete, session, options){
}

function createLongSession(athlete, session, options){

	var longPace = require('../models/long-pace.json');
	var totalDistance = athlete.runner.maxWeeklyDistance;
	var weekRatio = options.percentageOfWeeklyDistance;
	var totalIntervalDistance = totalDistance*weekRatio*longPace.maxPercentageOfWeeklyDistance*options.weighting;

	var distanceInKm = totalIntervalDistance/1000;
	var intervalDuration = (totalIntervalDistance/1000)*athlete.runner.paces.endurancePace;

	intervalDuration = parseInt(15*Math.round(intervalDuration/15))

	var numberOfReps = 1;

	var session = {
		type:'Marathon',
		sets:[],
		totalDistance:totalIntervalDistance
	}
	
	var iterations = 1;
	
	for(var i=0;i<iterations;i++){
		var set = {};		
		set.intervals = [];
		for(var x=0;x<numberOfReps;x++){
			set.intervals.push({
				duration:intervalDuration,
				pace:athlete.runner.paces.endurancePace
			})
		}
		session.sets.push(set);
	}
	return session;
}

function createMarathonSession(athlete, session, options){
	console.log('MARATHON SESSION');
	var marathon = require('../models/marathon-pace.json');
	var totalDistance = athlete.runner.maxWeeklyDistance;
	var weekRatio = options.percentageOfWeeklyDistance;
	var totalIntervalDistance = totalDistance*weekRatio*marathon.maxPercentageOfWeeklyDistance*options.weighting;
	var durations = marathon.durations;
	var index = randomIntFromInterval(0,durations.length-1);
	var intervalDuration = durations[index];

	var totalDuration = totalIntervalDistance/1000*athlete.runner.paces.marathonPace;
	totalDuration = parseInt(5*Math.round(totalDuration/5));
	intervalDuration = totalDuration;	

	var ratio = intervalDuration/athlete.runner.paces.marathonPace;
	var intervalDistance = 1000*ratio;

	var numberOfReps = Math.round(totalIntervalDistance/intervalDistance);

	var session = {
		type:'Marathon',
		sets:[],
		totalDistance:totalIntervalDistance
	}
	
	var iterations = 1;
	
	for(var i=0;i<iterations;i++){
		var set = {};		
		set.intervals = [];
		for(var x=0;x<numberOfReps;x++){
			set.intervals.push({
				duration:intervalDuration,
				pace:athlete.runner.paces.marathonPace,
				recovery:marathon.recovery
			})
		}
		session.sets.push(set);
		if(iterations == 2){
			session.sets.push({
				intervals:[
					{
						duration:(numberOfReps*repDistance/1000*athlete.runner.paces.repetition),
						pace:athlete.runner.paces.endurancePace	
					}
				]
			})
		}
	}
	return session;
}

function createLongThresholdSession(athlete, session, options){
	var threshold = require('../models/long-threshold-pace.json');
	var totalDistance = athlete.runner.maxWeeklyDistance;
	var weekRatio = options.percentageOfWeeklyDistance;
	var totalIntervalDistance = totalDistance*weekRatio*threshold.maxPercentageOfWeeklyDistance*options.weighting;
	var durations = threshold.durations;
	var index = randomIntFromInterval(0,durations.length-1);
	var intervalDuration = durations[index];

	var ratio = intervalDuration/athlete.runner.paces.thresholdPace;
	var intervalDistance = 1000*ratio;

	var numberOfReps = Math.round(totalIntervalDistance/intervalDistance);

	var session = {
		type:'Threshold',
		sets:[],
		totalDistance:totalIntervalDistance
	}
	
	var iterations = 1;
	
	for(var i=0;i<iterations;i++){
		var set = {};		
		set.intervals = [];
		for(var x=0;x<numberOfReps;x++){
			set.intervals.push({
				duration:intervalDuration,
				pace:athlete.runner.paces.thresholdPace,
				recovery:threshold.recovery
			})
		}
		session.sets.push(set);
		if(iterations == 2){
			session.sets.push({
				intervals:[
					{
						duration:(numberOfReps*repDistance/1000*athlete.runner.paces.repetition),
						pace:athlete.runner.paces.endurancePace	
					}
				]
			})
		}
	}
	return session;
}

function createHillSession(athlete, session, options){
}