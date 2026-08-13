package com.meroshare.backend.service;

import com.meroshare.backend.config.RedisConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Wraps MeroshareApiService calls that return CDSC static metadata.
 * Caching lives on its own bean so the calls always go through the
 * Spring cache proxy, even when invoked from other beans. Only raw
 * data types are cached here, not ResponseEntity or other wrappers.
 */
@Service
@RequiredArgsConstructor
public class CdscMetadataService {

    private final MeroshareApiService meroshareApiService;

    @Cacheable(cacheNames = RedisConfig.CACHE_CDSC_STATIC, key = "'dp-list'")
    public List<Map> getDpList() {
        return meroshareApiService.getDpList();
    }

    @Cacheable(cacheNames = RedisConfig.CACHE_CDSC_STATIC, key = "'bank-by-dp:' + #dpId")
    public Map<String, Object> getBankByDp(Integer dpId) {
        return meroshareApiService.getBankByDp(dpId);
    }
}