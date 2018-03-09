#!/usr/bin/env ruby

require './TopLevel.rb'
require 'json'

json = File.read("sample.json")
hash = JSON.parse(json, symbolize_names: true)
top = TopLevel.parse json
puts top