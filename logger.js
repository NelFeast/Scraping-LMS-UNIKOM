require("colour");

const Logger = {
    prefix: {
        g: '[INFO]: '.blue,
        e: '[WARN]: '.red,
    },
    __: function(prefix, msg) {
        console.log(prefix + "" + msg.white.bold);
    },
    warn: function() {
        let msg = Array.from(arguments).join(" ");
        if (msg) {
            Logger.__(Logger.prefix.e, msg);
        }
    },
    info: function() {
        let msg = Array.from(arguments).join(" ");
        if (msg) {
            Logger.__(Logger.prefix.g, msg);
        }
    }
};

module.exports = Logger;
