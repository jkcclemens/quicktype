#!/usr/bin/env ruby

require 'json'
require './TopLevel.rb'

json = File.read(ARGV[0])
top = TopLevel.parse json

puts JSON.generate(top)
