# SnapshotsMaker

Basic Snapshot Server (Like prerender.io) made with phantomjs.

Require:

phantomjs > 2.0

Basically start a server that wait for calls that need to be rendered previously
to show to the search engine's bots to crawl contents.

It requires from the single page app, to put a metatag "rendered" when finish the
operations and calls to response all together. It doesnt work for post, put, delete, etc. calls,
and the js doesn't work correctly. But is for crawling and its enough to cover the bots needs by the moment in my proyect although there are a lot of posibilities.

In the server side, we detect the bot, and make a request to the snapshot server with this format:

http://localhost:3000/?url=ENCODED_URL

Be sure phantomjs is accesible from command line to the crontab user wher you install.
You can make a symbolic link to phantomjs in /usr/bin to fix this problem.

Add this lines to the crontab to check the server status and restart if needed, the second line is
necessary to launch the snapshots-maker:

*/1 * * * * cd /var/opt/snapshots-maker/; ./start >> /var/opt/snapshots-maker/storage/`date +\%Y-\%m-\%d`-snapshots-server.log 2>&1

0 3 * * * cd /var/opt/snapshots-maker/; php snapshots-maker.php >> /var/opt/snapshots-maker/storage/`date +\%Y-\%m-\%d`-snapshots-maker.log 2>&1
