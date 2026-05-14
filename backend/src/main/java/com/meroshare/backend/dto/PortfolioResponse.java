package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PortfolioResponse {

    private double totalValueLTP;
    private double totalValuePrevClose;
    private int totalItems;
    private List<PortfolioItem> items;

    @Data
    @Builder
    public static class PortfolioItem {
        private String script;
        private String scriptDesc;
        private double currentBalance;
        private double lastTransactionPrice;
        private double previousClosingPrice;
        private double valueAsOfLTP;
        private double valueAsOfPrevClose;
    }
}