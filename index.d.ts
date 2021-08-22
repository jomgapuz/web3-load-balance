import Web3 from "web3";
import type { AbiItem } from "web3-utils";
import type { Contract } from "web3-eth-contract";
export * from "./utils";
export declare type ContractInfo = {
    abi: AbiItem[] | AbiItem;
    address: string;
};
export declare const createWeb3ContractsServices: <ContractName extends string>(nodesUrls: string[], contractDetailsMap: Record<ContractName, ContractInfo>) => {
    url: string;
    web3: Web3;
    contracts: Record<ContractName, Contract>;
}[];
export declare const createLoadBalancedContractsService: <ContractName extends string>(contractsServices: {
    url: string;
    web3: Web3;
    contracts: Record<ContractName, Contract>;
}[], options?: {
    initialServiceIndex?: number | undefined;
    initialServicesStats?: {
        firstRequestAtMillis: number;
        numberOfAccesses: number;
    }[] | undefined;
    retryOnErrorDelayInMillis?: number | undefined;
    retryOnRateLimitInSeconds?: number | undefined;
    maxRequestsPerNode?: number | undefined;
    maxDurationOfMaxRequestsPerNodeInMinutes?: number | undefined;
    rateLimitFactor?: number | undefined;
} | undefined) => {
    nodeIndex: () => number;
    /**
     * `NOTE` Only do one (1) node request to take advantage of
     * load balancing.
     *
     * Example of old `web3` convention. See the next snippet after this.
     *
     * ```
     * CryptoBladesContract.methods:
     * 	.inGameOnlyFunds('0xF9BDE92bF245c3CeB30bc556AE1D56E05bF56335)
     * 	.call({
     * 		from: "0x0000000000000000000000000000000000000000"
     * 	})
     * ```
     *
     * Example of new `web3-load-balance` convention:
     *
     * ```
     * runContract(
     * 	'cryptoblades',
     * 	'inGameOnlyFunds',
     * 	['0xF9BDE92bF245c3CeB30bc556AE1D56E05bF56335'],
     * 	{ form: '0x0000000000000000000000000000000000000000' }
     * )
     * ```
     */
    runContract: (contractName: ContractName, methodName: string, methodParameters?: any[] | undefined, callParameters?: Record<string, any> | undefined, options?: {
        retryIntervalInSeconds?: number | undefined;
    } | undefined) => Promise<any>;
    /**
     * `NOTE` Only do one (1) node request to take advantage of
     * load balancing.
     *
     * Example:
     *
     * ```
     * runWeb3((web3) => web3.eth.getBlock(12345678))
     * ```
     */
    runWeb3: <T>(callback: (web3: Web3) => T, options?: {
        retryOnRateLimitInSeconds?: number | undefined;
    } | undefined) => Promise<T>;
};
