<?php
return [
    'env' => 'local',
    'local' => [
        'domains' => [
            'pornolistas.es.local'
        ],
        'basePath' => '/var/www/vhosts/snapshots-maker/',
        'dbPath' => '/var/www/vhosts/snapshots-maker/storage/snapshots.db',
        //Time in seconds
        'waitAfterServerDown' => 5,
        'waitAfterServerFault' => 5,
        'waitAfterRequest'  => 1,
        'maxTimeConnection' => 5,
    ],
    'testing' => [
        'domains' => [
            'testing.pornolistas.es'
        ],
        'basePath' => '/var/opt/snapshots-maker/',
        'dbPath' => '/dev/shm/snapshots.db',
        'waitAfterServerDown' => 20,
        'waitAfterServerFault' => 5,
        'waitAfterRequest'  => 1,
        'maxTimeConnection' => 5,
    ],
    'production' => [
        'domains' => [
            'pornolistas.es',
            'pornolistas.com',
            'pornlists.net',
            'pornolisten.de',
            'pornolijsten.com',
            'omarsex.com',
            'wetdog.tv',
            'grannylovers.net',
            'bondagelove.net',
            'pornomari.com',
            'trannylovers.net',
            'cumshots.space',
            'asialovers.net',
            'maturelover.net',
            'teenagelovers.net'
        ],
        'basePath' => '/var/opt/snapshots-maker/',
        'dbPath' => '/var/opt/snapshots-maker/storage/snapshots.db',
        'waitAfterServerDown' => 20,
        'waitAfterServerFault' => 5,
        'waitAfterRequest'  => 1,
        'maxTimeConnection' => 5,
    ]
];
