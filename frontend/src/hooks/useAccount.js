import { useContext } from "react";
import { AccountContext } from "../context/AccountContext";

export const useAccount = () => useContext(AccountContext);