"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoadBalancedContractsService = exports.createWeb3ContractsServices = void 0;
const web3_1 = __importDefault(require("web3"));
const utils_1 = require("./utils");
__exportStar(require("./utils"), exports);
const createWeb3ContractsServices = (nodesUrls, contractDetailsMap) => {
    const web3Services = nodesUrls.map((url) => {
        const web3 = new web3_1.default(url);
        const contracts = Object.entries(contractDetailsMap).reduce((map, [contractName, { abi, address }]) => {
            const contract = new web3.eth.Contract(abi, address);
            return Object.assign(Object.assign({}, map), { [contractName]: contract });
        }, {});
        return {
            url,
            web3: web3,
            contracts,
        };
    });
    // const contract = new web3Services[0].eth.Contract();
    return web3Services;
};
exports.createWeb3ContractsServices = createWeb3ContractsServices;
const createLoadBalancedContractsService = (contractsServices, options) => {
    const { initialServiceIndex = 0, initialServicesStats = [], retryOnErrorDelayInMillis = 1000, retryOnRateLimitInSeconds = 3, maxRequestsPerNode = 10000, maxDurationOfMaxRequestsPerNodeInMinutes = 5, rateLimitFactor = 5, } = options || {};
    const finalMaxRequestsPerNode = maxRequestsPerNode / rateLimitFactor;
    const finalMaxDurationOfMaxRequestsPerNodeInMinutes = maxDurationOfMaxRequestsPerNodeInMinutes / rateLimitFactor;
    /**
     * For load balancing round robin
     */
    let serviceIndex = initialServiceIndex;
    const tempServicesStats = initialServicesStats.map((stats) => (Object.assign({}, stats)));
    const servicesStats = tempServicesStats.length === contractsServices.length
        ? tempServicesStats
        : contractsServices.map(() => ({
            firstRequestAtMillis: Date.now(),
            numberOfAccesses: 0,
        }));
    const canRequest = (currentNodeIndex) => {
        const { numberOfAccesses, firstRequestAtMillis } = servicesStats[currentNodeIndex];
        if (numberOfAccesses < finalMaxRequestsPerNode) {
            servicesStats[currentNodeIndex].numberOfAccesses += 1;
            return true;
        }
        if (utils_1.hasNumberOfMinutesPast(firstRequestAtMillis, finalMaxDurationOfMaxRequestsPerNodeInMinutes)) {
            servicesStats[currentNodeIndex].firstRequestAtMillis = Date.now();
            servicesStats[currentNodeIndex].numberOfAccesses = 1;
            return true;
        }
        return false;
    };
    const getService = (finalRetryOnRateLimitInSeconds = retryOnRateLimitInSeconds) => new Promise((resolve) => {
        const currentNodeIndex = serviceIndex;
        serviceIndex = (serviceIndex + 1) % contractsServices.length;
        if (canRequest(currentNodeIndex)) {
            resolve(contractsServices[currentNodeIndex]);
            return;
        }
        const interval = setInterval(() => {
            if (canRequest(currentNodeIndex)) {
                clearInterval(interval);
                resolve(contractsServices[currentNodeIndex]);
            }
        }, 1000 * finalRetryOnRateLimitInSeconds);
    });
    const runContract = async (contractName, methodName, methodParameters, callParameters, options) => {
        const retryIntervalInSeconds = (options === null || options === void 0 ? void 0 : options.retryIntervalInSeconds) || retryOnRateLimitInSeconds;
        const onFailure = (options === null || options === void 0 ? void 0 : options.onFailure) || (() => true);
        const service = await getService(retryIntervalInSeconds);
        const contract = service.contracts[contractName];
        const runMethod = contract.methods[methodName];
        if (utils_1.isFunction(runMethod)) {
            const methodResult = methodParameters
                ? runMethod(...methodParameters)
                : runMethod();
            const { call } = utils_1.isObject(methodResult)
                ? methodResult
                : { call: undefined };
            if (utils_1.isFunction(call)) {
                return (callParameters ? call(callParameters) : call()).catch(async (error) => {
                    if (error instanceof Error) {
                        const isContinue = onFailure(error);
                        if (!isContinue)
                            return null;
                        if (!retryOnErrorDelayInMillis) {
                            return Promise.reject(error);
                        }
                    }
                    await utils_1.sleep(retryOnErrorDelayInMillis);
                    return runContract(contractName, methodName, methodParameters, callParameters, options);
                });
            }
        }
        return null;
    };
    const runWeb3 = async (callback, options) => {
        const { retryOnRateLimitInSeconds: finalRetryOnRateLimitInSeconds = retryOnRateLimitInSeconds, onFailure = () => true, } = options || {};
        const service = await getService(finalRetryOnRateLimitInSeconds);
        return callback(service.web3).catch(async (error) => {
            if (error instanceof Error) {
                const isContinue = onFailure(error);
                if (!isContinue)
                    return null;
                if (!retryOnErrorDelayInMillis) {
                    return Promise.reject(error);
                }
            }
            await utils_1.sleep(retryOnErrorDelayInMillis);
            return runWeb3(callback, options);
        });
    };
    const onContract = async (contractName, callback, options) => {
        const { retryIntervalInSeconds: finalRetryIntervalInSeconds = retryOnRateLimitInSeconds, onFailure = () => true, } = options || {};
        const service = await getService(finalRetryIntervalInSeconds);
        return callback(service.contracts[contractName]).catch(async (error) => {
            if (error instanceof Error) {
                const isContinue = onFailure(error);
                if (!isContinue)
                    return null;
                if (!retryOnErrorDelayInMillis) {
                    return Promise.reject(error);
                }
            }
            await utils_1.sleep(retryOnErrorDelayInMillis);
            return onContract(contractName, callback, options);
        });
    };
    return {
        nodeIndex: () => serviceIndex,
        runContract,
        runWeb3,
        onContract,
    };
};
exports.createLoadBalancedContractsService = createLoadBalancedContractsService;
