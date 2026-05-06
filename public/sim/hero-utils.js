function getHeroSuffix(gen) {
    if (gen === 1) return "";
    if (gen === 2) return " Jr";
    let j = gen % 10,
        k = gen % 100;
    if (j == 1 && k != 11) return " the " + gen + "st";
    if (j == 2 && k != 12) return " the " + gen + "nd";
    if (j == 3 && k != 13) return " the " + gen + "rd";
    return " the " + gen + "th";
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getHeroSuffix };
}
