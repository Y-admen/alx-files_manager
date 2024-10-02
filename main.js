import dbClient from './utils/db';

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const waitConnection = () => {
    return new Promise((resolve, reject) => {
        let i = 0;
        const repeatFct = async() => {
            setTimeout(async() => {
                i += 1;
                if (i >= 10) {
                    reject();
                } else if (!await dbClient.isAlive()) {
                    repeatFct();
                } else {
                    resolve();
                }
            }, 1000);
        };
        repeatFct();
    });
};

(async() => {
    console.log(await dbClient.isAlive());
    await waitConnection();
    console.log(await dbClient.isAlive());
    console.log(await dbClient.nbUsers());
    console.log(await dbClient.nbFiles());
})();