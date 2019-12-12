import app from "./app";
/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3004');
app.set('port', port);

function normalizePort(val:any) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}


app.listen(port, () => {
    console.log('Express server listening on port ' + port);
});
