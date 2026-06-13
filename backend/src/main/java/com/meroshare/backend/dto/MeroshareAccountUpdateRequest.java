package com.meroshare.backend.dto;

import lombok.Data;

@Data
public class MeroshareAccountUpdateRequest {
    private String password;
    private String pin;
}