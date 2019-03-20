//==============================================================================
// Functions match the names supplied in the jsTest attribute of the test
// header. The tests in this case, being examples, both just check to see if
// the subject and control outputs match, but the sky's the limit on what you
// can do here, especially considering that you have the whole Node.js
// ecosystem to draw upon.
//
// Remember: return true on success and false on failure.
//==============================================================================

module.exports = {

    popReverseTest: function(cat, testId, data) {
        try {
            var data = JSON.parse(data);
        } catch(e) {
            console.log("popReverseTest threw an exception on " + cat + ":" + testId);
            return false;
        }

        // This would arguably be inefficient in production code, but with test
        // code, it's more than usually important to err on the side of simplicity
        // because a buggy test is worse than no test at all.

        var control = JSON.stringify(data.control);
        var subject = JSON.stringify(data.subject);

        return (control == subject) ? true : false;
    },

    joinDefaultTest: function(cat, testId, data) {
        try {
            var data = JSON.parse(data);
        } catch(e) {
            console.log("popReverseTest threw an exception on " + cat + ":" + testId);
            return false;
        }

        // Same code, shorter comment. Example, remember?

        var control = JSON.stringify(data.control);
        var subject = JSON.stringify(data.subject);

        return (control == subject) ? true : false;
    }

};
