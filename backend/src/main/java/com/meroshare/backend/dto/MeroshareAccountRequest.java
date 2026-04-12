package com.meroshare.backend.dto;

import lombok.Data;

@Data
public class MeroshareAccountRequest {
    private String dpId;
    private String username;
    private String password;
    private String crn;
    private String pin;
}