//==============================================================================
// To have something to test, we're going to use this buggy, incomplete,
// and awkward wrapper around a native JavaScript array, the CrappyArray.
//==============================================================================

class CrappyArray {

    constructor(...vals) {
        if(vals.length == 1 && typeof vals[0] == "number") {
            this._contents = new Array(vals[0]);
        } else {
            this._contents = vals;
        }
        this._length = this._contents.length;
    }

    //--------------------------------------------------------------------------
    // This is our crude replacement for the [] operator.
    //--------------------------------------------------------------------------

    element(offset, val) {
        if(val == undefined) {
            return this._contents[offset];
        } else {
            this._contents[offset] = val;
            return val;
        }
    }

    //--------------------------------------------------------------------------
    // Length reimplementation. The getter works fine, but the setter
    // erroneously changes this._length.
    //--------------------------------------------------------------------------

    get length() {
        return this._contents.length;
    }

    set length(val) {        // BUG: The length attribute of arrays should be
        this._length = val;   // read-only.
    }

    //--------------------------------------------------------------------------
    // Reimplementations of push, pop, shift, and unshift. The shift and
    // unshift methods are swapped, i.e., shift unshifts and unshift shifts.
    //--------------------------------------------------------------------------

    push(val) {
        this._contents.push(val);
        this._length++
    }

    pop() {
        this._length++;               // BUG: should be this._length--
        return this._contents.pop();
    }

    shift(val) {                     // BUG: should be unshift
        this._length++;
        this._contents.unshift(val);
    }

    unshift() {                      // BUG: should be shift
        this._length--;
        return this._contents.shift();
    }

    //--------------------------------------------------------------------------
    // A couple of additional methods: reverse and join. The join clone works
    // fine unless no separator is supplied, and reverse screws up if
    // this._length is inaccurate due to calls to our buggy pop method.
    //--------------------------------------------------------------------------

    reverse() {
        var tmp;
        for(var i = 0; i < this._length / 2; i++) {
            tmp = this._contents[i];
            this._contents[i] = this._contents[this._length - 1 - i];
            this._contents[this._length - 1 - i] = tmp;
        }
    }

    join(separator = null) {
        return this._contents.join(separator);
    }
}

module.exports = CrappyArray;
