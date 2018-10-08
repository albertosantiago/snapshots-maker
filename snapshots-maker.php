<?php
require __DIR__ . '/vendor/autoload.php';
require_once "php/lib/SitemapDB.php";

use Carbon\Carbon;

$startedAt = Carbon::now();

$conf = include('config-maker.php');
$conf = $conf[$conf['env']];
$sitemapDB = new SitemapDB($conf['dbPath']);

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

        curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);
        return $info['http_code'];

    }catch(Exception $e){
        echo "ERROR in CURL request:\n";
        echo $e->getMessage();
        return 500;
    }
}

function md5_hash($url){
    $url = rawurldecode($url);
    return md5($url);
}

function clear_cache($url){
    global $conf;
    $cacheFilePath = get_cache_filepath($url);
    if(file_exists($cacheFilePath)){
        echo "Removing cache file: $cacheFilePath\n";
        unlink($cacheFilePath);
    }
}

function get_cache_filepath($url){
	global $conf;
	$fileHash = md5_hash($url);
	$cacheSegment1 = substr($fileHash,0,1);
	$cacheSegment2 = substr($fileHash,1,1);
	$cacheSegment3 = substr($fileHash,2,2);
	$filePath = $conf['basePath'].'snapshots/'.$cacheSegment1."/".
				$cacheSegment2."/".$cacheSegment3."/".$fileHash;
	return $filePath;
}

function get_cache_size($url){
    global $conf;
    $cacheFilePath = get_cache_filepath($url);
    if(file_exists($cacheFilePath)){
         return filesize($cacheFilePath);
    }else{
        echo "Cache file not found:\n   URL: $url\n   Cache File: $cacheFilePath\n";
        return 0;
    }
}

function check_snapshots_server(){
    $pid = trim(file_get_contents("snapshots-server.pid"));
    echo "Checking Snapshot Server Process Status, PID: $pid.\n";
    if(file_exists("/proc/$pid")){
        echo "Server up! :]\n";
        return true;
    }
    echo "Server down! :[\n";
    return false;
}

function request_snaphot($url){
    global $conf;
    if(check_snapshots_server()){
        sleep($conf['waitAfterRequest']);
        clear_cache($url);
        $responseCode = get_url($url);
        if($responseCode == 200){
            echo "Snapshot request successful.\n";
            return true;
        }else{
            echo "Snapshot request failed.\n";
            echo "Sleeping ".$conf['waitAfterServerFault']." seconds before continues.\n";
            sleep($conf['waitAfterServerFault']);
            return false;
        }
    }else{
        echo "Snapshots Server down, waiting ".$conf['waitAfterServerDown']." seconds to check again...\n";
        sleep($conf['waitAfterServerDown']);
        return request_snaphot($url);
    }
}

function update_sitemaps(){
    echo "Updating Sitemaps...\n";
    global $sitemapDB;
    try{
        $sitemaps = $sitemapDB->getSitemapDomains();
        if($sitemaps){
            foreach($sitemaps as $sitemap){
                $updatedAt = new Carbon($sitemap['updatedAt']);
                echo "Last update of sitemap from ".$sitemap['domain']." at $updatedAt\n";
                $outdatedAt = Carbon::now()->subWeek();
                if($updatedAt < $outdatedAt){
                    echo "Outdated sitemap, older than $outdatedAt, launching update...\n";
                    update_sitemap($sitemap['domain']);
                }else{
                    echo "Already updated sitemap...\n";
                }
            }
        }else{
            reinstall();
            update_sitemaps();
        }
    }catch(\ErrorException $e){
        echo "There was an error:\n";
        var_dump($e);
    }
}

function update_sitemap($domain){
    global $sitemapDB;
    $urls = [];
    $url  = 'http://'.$domain.'/sitemap.xml';
    echo "Getting sitemap for $domain: $url\n";
    $xml = file_get_contents($url);
    $dom = new DOMDocument;
    $dom->loadXML($xml);
    $locs = $dom->getElementsByTagName('loc');
    foreach ($locs as $loc) {
        $urls[] = $loc->nodeValue;
    }
    $sitemapDB->updateSitemap($domain, $urls);
}

function update_snapshots(){
    global $sitemapDB;
    echo "Updating Snapshots...\n";
    $sitemaps = $sitemapDB->getSitemapDomains();
    if($sitemaps){
        foreach($sitemaps as $sitemap){
            $domain = $sitemap['domain'];
            $free   = false;
            echo "Updating Snapshots for $domain...\n";
            while(!$free){
                while($url = $sitemapDB->getOutdatedURL($domain)){
                    try{
                        $sitemapDB->setWorkInProgress($url);
                        echo "Requesting $url\n";
                        if(request_snaphot($url)){
                            $cacheSize = get_cache_size($url);
                            $sitemapDB->setUpdatedSnapshot($url, $cacheSize);
                        }
                    }catch(Exception $e){
                        $sitemapDB->clearWorkingStatus($url);
                        echo "There was a problem:\n";
                        echo $e->getMessage();
                        echo "\n";
                    }
                }
                if($sitemapDB->havePendingJobs($domain)){
                    echo "Zombie jobs found, cleaning...\n";
                    $sitemapDB->clearFailedJobs($domain);
                    $free = false;
                }else{
                    $free = true;
                }
            }
        }
    }
}

function reinstall(){
    global $conf, $sitemapDB;
    @unlink('storage/installed');
    @unlink($conf['dbPath']);
    $sitemapDB->refreshConnection();
    install();
}

function install(){
    global $conf, $sitemapDB;
    $sitemapDB->install();
    foreach($conf['domains'] as $domain){
        $sitemapDB->insertSitemap($domain);
    }
    touch('storage/installed');
}

function check_install(){
    if(file_exists('storage/installed')){
        echo "Already installed...\n";
        return true;
    }else{
        echo "Not installation found.\n";
        return false;
    }
}

function start(){
    if(!check_install()){
        install();
    }
    update_sitemaps();
    update_snapshots();
}

start();

$finishAt = Carbon::now();
$execTime = Carbon::now()->diffInSeconds($startedAt);
echo "=============================================
Execution finished.
StartedAt: $startedAt
Finish: $finishAt
Execution time: $execTime seconds
=============================================\n";
