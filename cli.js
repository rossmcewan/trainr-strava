#!/usr/bin/env node
'use strict';
var meow = require('meow');
var trainrStrava = require('./');

var cli = meow({
  help: [
    'Usage',
    '  trainr-strava <input>',
    '',
    'Example',
    '  trainr-strava Unicorn'
  ].join('\n')
});

trainrStrava(cli.input[0]);
