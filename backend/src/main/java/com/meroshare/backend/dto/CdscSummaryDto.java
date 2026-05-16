package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CdscSummaryDto {

    private int total;
    private int allotted;
    private int failed;
    private int notPublished;

    private List<Item> items;

    @Data
    @Builder
    public static class Item {
        private String companyName;
        private String scrip;
        private String shareTypeName;
        private String applicantFormId;
        private String companyShareId;
        private String resultStatus;
        private int allottedKitta;
    }
}