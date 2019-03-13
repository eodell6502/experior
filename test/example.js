module.exports = {

    hasNoAlpha: function(cat, testId, data) {
        var regex = RegExp("[A-Za-z]");
        return regex.test(data) ? false : true;
    }

};
