<?php
require __DIR__ . '/vendor/autoload.php';
require_once "php/lib/SitemapDB.php";

use Carbon\Carbon;

$startedAt = Carbon::now();
$errors = 0;

function get_url($url){
    global $conf;
    try{
        $ch = curl_init();
        $headers = array(
            "Accept: text/html"
        );
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, 'googlebot');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $conf['maxTimeConnection']);
        curl_setopt($ch, CURLOPT_TIMEOUT, $conf['maxTimeConnection']);

        $output = curl_exec($ch);
        $info   = curl_getinfo($ch);
        curl_close($ch);
        print_r($output);
        print_r($info);
        return $info;
    }catch(Exception $e){
        echo "ERROR in CURL request:\n";
        echo $e->getMessage();
        return 500;
    }
}

function start(){
    global $errors;
    $url = "http://pornolistas.es.local/player/";
    $start = 7569005;
    for($i=0;$i<150;$i++){
        $auxUrl = $url.$start;
        $info = get_url($auxUrl);
        if($info['http_code']!=200){
            $errors++;
        }
    }
}

start();

$finishAt = Carbon::now();
$execTime = Carbon::now()->diffInSeconds($startedAt);
echo "=============================================
Execution finished.
StartedAt: $startedAt
Finish: $finishAt
Execution time: $execTime seconds
Errors: $errors
=============================================\n";
