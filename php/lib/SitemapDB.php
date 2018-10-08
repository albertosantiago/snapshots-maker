<?php
use Carbon\Carbon;

class SitemapDB{

    private $db;
    private $dbPath;

    public function __construct($dbPath){
        $this->dbPath = $dbPath;
        $this->refreshConnection();
    }

    public function refreshConnection(){
        $this->db = new SQLite3($this->dbPath);
        $this->db->busyTimeout(5000);
    }

    public function install(){
        try{
            echo "Creating table sitemaps...\n";
            $query = "CREATE TABLE sitemaps(
                        domain CHAR(255),
                        updatedAt DATETIME)";

            @$this->db->exec($query);
            echo "Creating table urls...\n";
            $query = "CREATE TABLE urls(
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        url CHAR(255),
                        domain CHAR(255),
                        last_snapshot DATETIME,
                        cache_size INTEGER,
                        prev_cache_size INTEGER,
                        deleted BOOLEAN,
                        was_changed BOOLEAN,
                        work_in_progress BOOLEAN,
                        working_since DATETIME)";

            @$this->db->exec($query);
        }catch(\Exception $e){
            echo "Already installed\n";
        }
    }

    public function insertSitemap($domain){
        $updatedAt = Carbon::now()->subYears(1);
        $query = sprintf("INSERT INTO sitemaps (domain, updatedAt) VALUES ('%s', '%s');", $domain, $updatedAt);
        $this->db->exec($query);
        if($this->db->changes()>0){
            echo "Sitemap inserted: $domain\n";
        }else{
            echo "Problem updating/inserting $domain.\n";
        }
        return  $this->db->changes();
    }

    /**
    En sqlite, sino liberas los resultados tienes bloqueo asegurado.
    **/
    public function getSitemapDomains(){
        $sitemaps = [];
        $query = "SELECT domain, updatedAt FROM sitemaps";
        $ret   = $this->db->query($query);
        if($ret){
            while($sitemap = $ret->fetchArray(SQLITE3_ASSOC)){
                $sitemaps[] = $sitemap;
            }
            return $sitemaps;
        }
        return false;
    }

    public function updateSitemap($domain, $urls){
        echo "Inserting sitemap for $domain\n";
        $query = sprintf("UPDATE urls SET deleted = 1 WHERE domain='%s';", $domain);
        $this->db->exec($query);
        foreach ($urls as $url) {
            $this->insertOrUpdateURL($domain, $url);
        }
        $this->clearDeleted($domain);

        $now = Carbon::now();
        echo "Sitemap updated at $now\n";
        $query = sprintf("UPDATE sitemaps SET updatedAt = '%s' WHERE domain='%s';", $now, $domain);
        $this->db->exec($query);

        return  $this->db->changes();
    }

    public function insertOrUpdateURL($domain, $url){
        $query = sprintf("UPDATE urls SET deleted = 0, work_in_progress = 0 WHERE url='%s' AND domain = '%s';", $url, $domain);
        $ret = $this->db->exec($query);
        if($this->db->changes()>0){
            echo "URL updated: $url\n";
        }else{
            $query = sprintf("INSERT INTO urls (domain, url, deleted, work_in_progress, cache_size, prev_cache_size, was_changed) VALUES ('%s','%s', 0, 0, 0, 0, 0);", $domain, $url);
            $this->db->exec($query);
            if($this->db->changes()>0){
                echo "URL inserted: $url\n";
            }else{
                echo "Problem updating/inserting $url.\n";
            }
        }
        return  $this->db->changes();
    }

    public function setUpdatedSnapshot($url, $cacheSize){
        $now = Carbon::now();
        $query = sprintf("SELECT * from urls where url='%s'", $url);
        $urlData = $this->db->querySingle($query);

        $prevCacheSize = $urlData['cache_size'];
        $wasChanged = 0;
        if($prevCacheSize!==$cacheSize){
            $wasChanged = 1;
        }
        $query = sprintf("UPDATE urls SET
                            last_snapshot = '%s',
                            work_in_progress = 0,
                            working_since = null,
                            cache_size='%s',
                            prev_cache_size='%s',
                            was_changed='%s'
                        WHERE url='%s';",
                            $now, $cacheSize,
                            $prevCacheSize, $wasChanged,
                            $url);

        $this->db->exec($query);

        echo "Snapshot update for: $url\n";
        return  $this->db->changes();
    }

    public function clearDeleted($domain){
        echo "Cleaning deleted urls for $domain\n";
        $query = "DELETE FROM urls where deleted=1";
        $this->db->exec($query);
        return  $this->db->changes();
    }

    public function getOutdatedURL($domain=null){
        $outDate = Carbon::now()->subDay(1);
        $query = sprintf("SELECT url FROM urls WHERE (last_snapshot < Datetime('%s') OR last_snapshot IS NULL OR cache_size=0) AND work_in_progress = 0 ", $outDate);
        if($domain!=null){
            $query = $query." AND domain = '$domain'";
        }
        return $this->db->querySingle($query);
    }

    public function setWorkInProgress($url){
        $now = Carbon::now();
        $query = sprintf("UPDATE urls SET work_in_progress = 1, working_since='%s' WHERE url='%s';", $now, $url);
        $this->db->exec($query);
        return  $this->db->changes();
    }

    public function clearWorkingStatus($url){
        echo "Cleaning work in progress for $url\n";
        $query = sprintf("UPDATE urls SET work_in_progress = 0, working_since=null WHERE url='%s';", $url);
        $this->db->exec($query);
        return  $this->db->changes();
    }

    public function havePendingJobs($domain=null){
        echo "Checking pending jobs\n";
        $elapsedTime = Carbon::now()->subSeconds(10);
        $query = sprintf("SELECT COUNT(*) as total FROM urls WHERE work_in_progress = 1 AND working_since < '%s'", $elapsedTime);
        if($domain!=null){
            $query = $query." AND domain = '$domain'";
        }
        $ret = $this->db->querySingle($query);
        return $ret;
    }

    public function clearFailedJobs($domain=null){
        echo "Cleaning failed jobs\n";
        $elapsedTime = Carbon::now()->subSeconds(10);
        $query = sprintf("UPDATE urls SET work_in_progress = 0, working_since=null WHERE work_in_progress = 1 AND working_since < '%s' ", $elapsedTime);
        if($domain!=null){
            $query = $query." AND domain = '$domain'";
        }
        $this->db->exec($query);
        return  $this->db->changes();
    }
}
