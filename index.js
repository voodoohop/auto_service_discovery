
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const io = require("socket.io");
const os = require("os");

const bonjour = require('bonjour')();

async function unpublish() {
    console.log("unpublishing");
    try {
        await new Promise(resolve => bonjour.unpublishAll(resolve));
    } catch (e) {
        console.error("Couldn't unpublish but continuing.");
        console.error(e);
    }
}

nodeCleanup(unpublish);
// 1 hour default time-to-live
const DEFAULT_TTL = 60 * 60 * 1000;

const host = os.hostname();

async function createService(serviceDescription = null) {

    const port = await portfinder.getPortPromise();
    const socket = io.listen(port);

    let intervalHandle = -1;
    const publish = ({ type, txt, name = null, isUnique = true }) => {
        if (name === null)
            name = `${process.title}_${type}`;
        if (isUnique)
            name = `${name}_${process.pid}`;

        const publishParams = { name, type, port, host, txt };

        console.log("Publishing", publishParams);

        bonjour.publish(publishParams);

        if (intervalHandle > 0)
            clearInterval(intervalHandle);

        intervalHandle = setInterval(async () => {
            console.log("Republishing service.");
            await unpublish();
            bonjour.publish(publishParams);
        }, DEFAULT_TTL);
    }

    if (serviceDescription !== null)
        publish(serviceDescription);

    return {
        socket,
        publish
    }
}

const filterLocal = callback => service => {
    if (service.host === host)
        callback(service);
}

function findService({ type, txt, local = true }, callback) {

    if (local)
        callback = filterLocal(callback);

    bonjour.find({ type, txt }, callback);
}

function findServiceOnce(options) {
    return new Promise(resolver => findService(options, resolver));
}

module.exports = { createService, findService, findServiceOnce };

