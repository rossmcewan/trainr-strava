'use strict';

var moment = require('moment');

var Calculator = function (params) {
    console.log(this);
    var self = this;
    self.params = params;
};

Calculator.prototype.calculate = calculate;
Calculator.prototype.predict = predict;
Calculator.prototype.format = format;
Calculator.prototype.easy = easy;
Calculator.prototype.recovery = recovery;
Calculator.prototype.interval = interval;
Calculator.prototype.repetition = repetition;
Calculator.prototype.marathon = marathon;
Calculator.prototype.tempo = tempo;

module.exports = Calculator;

function calculate(dist, hours, mins, secs) {
    var th = hours * 60;
    var tm = mins;
    var ts = secs / 60;
    var time = th + tm + ts;
    var dist = dist * 1000;
    var d = dist / time;
    var p1 = Math.exp(-0.012778 * time);
    p1 = p1 * 0.1894393;
    var p2 = Math.exp(-0.1932605 * time);
    p2 = p2 * 0.2989558;
    var p = 0.8 + p1 + p2;
    var v = -4.6;
    v = v + (0.182258 * d);
    v = v + (0.000104 * d * d);
    return (v / p);
}

function format(val) {
    return moment().startOf('day')
        .seconds(val)
        .format('H:mm:ss');
}

function km(val, miles) {
    var result = (val / 1.60935);
    return result;
}

function recovery(vdot) {
    console.log('recovery: ', this);
    var y = Math.pow((vdot * (0.65 - 0.06)), 2);
    var z = (1 / (29.54 + 5.000663 * (vdot * (0.65 - 0.06)) - 0.007546 * y) * 1609.344 / 1440);
    return km(z * 60 * 60 * 24);
}

function easy(vdot) {
    var y = Math.pow((vdot * (0.73 - 0.06)), 2);
    var z = (1 / (29.54 + 5.000663 * (vdot * (0.73 - 0.06)) - 0.007546 * y) * 1609.344 / 1440)
    return km(z * 60 * 60 * 24);
}

//function predict(vdot, dist, hours, mins, secs, target) {
function predict(vdot, target) {
    var self = this;
    console.log('predict: ', this);
    var dist = self.params.distance;
    var hours = self.params.hours;
    var mins = self.params.minutes;
    var secs = self.params.seconds;
    var th = hours * 60;
    var tm = mins;
    var ts = secs / 60;
    var time = (th + tm + ts);
    var x = (target / dist);
    var y = Math.pow(x, 1.06);
    var z = time / 60 / 24;
    var a = y * z;
    return (a * 60 * 24 * 60) / target;
}

function marathon(vdot) {
    console.log('marathon: ', this);
    return predict.bind(this)(vdot, 42.195);
}

function tempo(vdot) {
    console.log('tempo: ', this);
    var z = ((29.54 + 5.000663 * (vdot * 0.88) - 0.007546 * Math.pow(vdot * 0.88, 2)));
    var y = 1 / z * 1609.344 / 1440
    return km(y * 60 * 24 * 60);
}

function interval(vdot) {
    var z = (1 / (29.54 + 5.000663 * (vdot * 0.98) - 0.007546 * Math.pow(vdot * 0.98, 2)) * 1609.344 / 1440);
    return km(z * 60 * 24 * 60);
}

function repetition(vdot) {
    var y = Math.pow((vdot * (1.03 + 0.1 * (vdot - 30) / 55)), 2);
    var z = (1 / (29.54 + 5.000663 * (vdot * (1.03 + 0.1 * (vdot - 30) / 55)) - 0.007546 * y) * 1000 / 1440);
    return (z * 60 * 24 * 60);
}