require 'dry-types'
require 'dry-struct'

module Types
  include Dry::Types.module
  Egg = Types::String.enum("Not in Eggs", "Omanyte Candy", "10 km", "2 km", "5 km")
  Weakness = Types::String.enum("Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Poison", "Psychic", "Rock", "Steel", "Water")
end

module Egg
  NotInEggs = "Not in Eggs"
  OmanyteCandy = "Omanyte Candy"
  The10KM = "10 km"
  The2KM = "2 km"
  The5KM = "5 km"
end

class Evolution < Dry::Struct
  attribute :num,  Types::String
  attribute :name, Types::String

  def self.parse json
    json = JSON.parse(json) unless json.is_a?(Hash)
    Evolution.new(
      num:  json["num"],
      name: json["name"],
    )
  end
end

module Weakness
  Bug = "Bug"
  Dark = "Dark"
  Dragon = "Dragon"
  Electric = "Electric"
  Fairy = "Fairy"
  Fighting = "Fighting"
  Fire = "Fire"
  Flying = "Flying"
  Ghost = "Ghost"
  Grass = "Grass"
  Ground = "Ground"
  Ice = "Ice"
  Poison = "Poison"
  Psychic = "Psychic"
  Rock = "Rock"
  Steel = "Steel"
  Water = "Water"
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

  def self.parse json
    json = JSON.parse(json) unless json.is_a?(Hash)
    Pokemon.new(
      id:             json["id"],
      num:            json["num"],
      name:           json["name"],
      img:            json["img"],
      type:           json["type"].map { |x| x },
      height:         json["height"],
      weight:         json["weight"],
      candy:          json["candy"],
      candy_count:    json["candy_count"].nil? ? nil : json["candy_count"],
      egg:            Types::Egg[json["egg"]],
      spawn_chance:   json["spawn_chance"],
      avg_spawns:     json["avg_spawns"],
      spawn_time:     json["spawn_time"],
      multipliers:    json["multipliers"].nil? ? nil : json["multipliers"].map { |x| x },
      weaknesses:     json["weaknesses"].map { |x| Types::Weakness[x] },
      next_evolution: json["next_evolution"].nil? ? nil : json["next_evolution"].map { |x| Evolution.parse(x) },
      prev_evolution: json["prev_evolution"].nil? ? nil : json["prev_evolution"].map { |x| Evolution.parse(x) },
    )
  end
end

class TopLevel < Dry::Struct
  attribute :pokemon, Types.Array(Types.Instance(Pokemon))

  def self.parse json
    json = JSON.parse(json) unless json.is_a?(Hash)
    TopLevel.new(
      pokemon: json["pokemon"].map { |x| Pokemon.parse(x) },
    )
  end
end
