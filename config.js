module.exports = {
  prefix: "mb",
  admins: ["1451533934130364467"],

  economy: {
    startCash: 2500,
    daily: 6000
  },

  casino: {
    slotsMulti: 5,
    blackjackMulti: 2,
    jackpotChance: 0.03
  },

  pets: {
    list: {
      cat: { cost: 10000, power: 1, multi: 0.1 },
      wolf: { cost: 50000, power: 3, multi: 0.25 },
      dragon: { cost: 250000, power: 8, multi: 0.6 }
    }
  },

  raids: {
    cooldown: 3600000,
    baseBank: 100000
  },

  seasons: {
    duration: 7 * 24 * 60 * 60 * 1000
  }
};
