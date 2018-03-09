# To parse JSON, add 'dry-struct' and 'dry-types' gems, then:
#
#   top_level = TopLevel.from_json "..."
#

require 'json'
require 'dry-types'
require 'dry-struct'

module Types
  include Dry::Types.module
  Egg = Types::String.enum("Not in Eggs", "Omanyte Candy", "10 km", "2 km", "5 km")
  Weakness = Types::String.enum("Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Poison", "Psychic", "Rock", "Steel", "Water")
end

module Egg
  NotInEggs    = "Not in Eggs"
  OmanyteCandy = "Omanyte Candy"
  The10KM      = "10 km"
  The2KM       = "2 km"
  The5KM       = "5 km"
end

class Evolution < Dry::Struct
  attribute :num,  Types::String
  attribute :name, Types::String

  def self.from_dynamic(d)
    Evolution.new(
      num:  d["num"],
      name: d["name"],
    )
  end

  def self.from_json(json) from_dynamic(JSON.parse(json)) end

  def to_dynamic
    {
      "num"  => @num,
      "name" => @name,
    }
  end

  def to_json() JSON.generate(to_dynamic) end
end

module Weakness
  Bug      = "Bug"
  Dark     = "Dark"
  Dragon   = "Dragon"
  Electric = "Electric"
  Fairy    = "Fairy"
  Fighting = "Fighting"
  Fire     = "Fire"
  Flying   = "Flying"
  Ghost    = "Ghost"
  Grass    = "Grass"
  Ground   = "Ground"
  Ice      = "Ice"
  Poison   = "Poison"
  Psychic  = "Psychic"
  Rock     = "Rock"
  Steel    = "Steel"
  Water    = "Water"
end

class Pokemon < Dry::Struct
  attribute :id,             Types::Int
  attribute :num,            Types::String
  attribute :name,           Types::String
  attribute :img,            Types::String
  attribute :type,           Types.Array(Types::String)
  attribute :height,         Types::String
  attribute :weight,         Types::String
  attribute :candy,          Types::String
  attribute :candy_count,    Types::Int.optional
  attribute :egg,            Types::Egg
  attribute :spawn_chance,   Types::Decimal
  attribute :avg_spawns,     Types::Decimal
  attribute :spawn_time,     Types::String
  attribute :multipliers,    Types.Array(Types::Decimal).optional
  attribute :weaknesses,     Types.Array(Types::Weakness)
  attribute :next_evolution, Types.Array(Types.Instance(Evolution)).optional
  attribute :prev_evolution, Types.Array(Types.Instance(Evolution)).optional

  def self.from_dynamic(d)
    Pokemon.new(
      id:             d["id"],
      num:            d["num"],
      name:           d["name"],
      img:            d["img"],
      type:           d["type"],
      height:         d["height"],
      weight:         d["weight"],
      candy:          d["candy"],
      candy_count:    d["candy_count"],
      egg:            d["egg"],
      spawn_chance:   d["spawn_chance"],
      avg_spawns:     d["avg_spawns"],
      spawn_time:     d["spawn_time"],
      multipliers:    d["multipliers"],
      weaknesses:     d["weaknesses"],
      next_evolution: d["next_evolution"]&.map { |x| Evolution.from_dynamic(x) },
      prev_evolution: d["prev_evolution"]&.map { |x| Evolution.from_dynamic(x) },
    )
  end

  def self.from_json(json) from_dynamic(JSON.parse(json)) end

  def to_dynamic
    {
      "id"             => @id,
      "num"            => @num,
      "name"           => @name,
      "img"            => @img,
      "type"           => @type,
      "height"         => @height,
      "weight"         => @weight,
      "candy"          => @candy,
      "candy_count"    => @candy_count,
      "egg"            => @egg,
      "spawn_chance"   => @spawn_chance,
      "avg_spawns"     => @avg_spawns,
      "spawn_time"     => @spawn_time,
      "multipliers"    => @multipliers,
      "weaknesses"     => @weaknesses,
      "next_evolution" => @next_evolution&.map { |x| x.to_dynamic },
      "prev_evolution" => @prev_evolution&.map { |x| x.to_dynamic },
    }
  end

  def to_json() JSON.generate(to_dynamic) end
end

class TopLevel < Dry::Struct
  attribute :pokemon, Types.Array(Types.Instance(Pokemon))

  def self.from_dynamic(d)
    TopLevel.new(
      pokemon: d["pokemon"].map { |x| Pokemon.from_dynamic(x) },
    )
  end

  def self.from_json(json) from_dynamic(JSON.parse(json)) end

  def to_dynamic
    {
      "pokemon" => @pokemon.map { |x| x.to_dynamic },
    }
  end

  def to_json() JSON.generate(to_dynamic) end
end
