/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
declare const Parse: any;

import './generated/evmApi';
import './generated/solApi';

import { requestMessage } from '../auth/authService';
// @ts-ignore
import { logger } from "parse-server";
import {ethers} from "hardhat";

Parse.Cloud.define('requestMessage', async ({ params }: any) => {
  const { address, chain, networkType } = params;

  const message = await requestMessage({
    address,
    chain,
    networkType,
  });

  return { message };
});

Parse.Cloud.define('getPluginSpecs', () => {
  // Not implemented, only excists to remove client-side errors when using the moralis-v1 package
  return [];
});

Parse.Cloud.define('getServerTime', () => {
  // Not implemented, only excists to remove client-side errors when using the moralis-v1 package
  return null;
});

Parse.Cloud.define('tf1', () => {
  logger.info('this is a logged message from a cloud function');
  logger.error('this is a logged error from a cloud function 1');
  return ['this is test function 1'];
});

Parse.Cloud.define('tf2', () => {
  return [['this is'], 'this is test function 1'];
});

Parse.Cloud.afterSave('ItemListed', async(request : any, params : any) => {
  logger.info("After Save ItemListed")
  logger.info("request : ", request)
  logger.info("params: ", params)
  const ActiveItem = Parse.Object.extend("ActiveItem")

  // In case of listing update, search for already listed ActiveItem and delete
  const query = new Parse.Query(ActiveItem)
  query.equalTo("nftAddress", request.object.get("nftAddress"))
  query.equalTo("tokenId", request.object.get("tokenId").toString())
  query.equalTo("marketplaceAddress", request.object.get("address"))
  query.equalTo("seller", request.object.get("seller"))
  logger.info(`Marketplace | Query: ${query}`)
  const alreadyListedItem = await query.first()
  console.log(`alreadyListedItem ${JSON.stringify(alreadyListedItem)}`)
  if (alreadyListedItem) {
      logger.info(`Deleting ${alreadyListedItem.id}`)
      await alreadyListedItem.destroy()
      logger.info(
          `Deleted item with tokenId ${request.object.get(
              "tokenId"
          ).toString()} at address ${request.object.get(
              "address"
          )} since the listing is being updated. `
      )
  }

  // Add new ActiveItem
  const activeItem = new ActiveItem()
  activeItem.set("marketplaceAddress", request.object.get("address"))
  activeItem.set("nftAddress", request.object.get("nftAddress"))
  activeItem.set("price", request.object.get("price"))
  activeItem.set("tokenId", request.object.get("tokenId").toString())
  activeItem.set("seller", request.object.get("seller"))
  logger.info(
      `Adding Address: ${request.object.get("address")} TokenId: ${request.object.get(
          "tokenId").toString()}`
  )
  logger.info("Saving...")
  await activeItem.save()
})

Parse.Cloud.afterSave('ItemBought', async(request:any) => {
  logger.info("After Save CanceledItem")
  logger.info(`Marketplace | Object: ${request.object}`)
  const ActiveItem = Parse.Object.extend("ActiveItem")
  const query = new Parse.Query(ActiveItem)
  // query.equalTo("marketPlaceAddress", request.object.get("address"))
  query.equalTo("nftAddress", request.object.get("nftAddress"))
  query.equalTo("tokenId", request.object.get("tokenId").toString())
  logger.info(`Marketplace | Query: ${query}`)
  const boughtItem = await query.first()
  logger.info(`Marketplace | CanceledItem: ${JSON.stringify(boughtItem)}`)

  if(boughtItem){
    logger.info(`Deleting boughtItem ${boughtItem.id}`)
    await boughtItem.destroy()
    logger.info(
      `Deleted item with tokenId ${request.object.get(
          "tokenId"
      ).toString()} at address ${request.object.get(
          "address"
      )} from ActiveItem table since it was bought.`
    )
  }else{
    logger.info(
      `No item bought with address: ${request.object.get(
          "address"
      )} and tokenId: ${request.object.get("tokenId").toString()} found`
    )
  }
})

Parse.Cloud.afterSave('ItemCanceled', async(request : any, params : any) => {
  logger.info("After Save CanceledItem")
  logger.info(`Marketplace | Object: ${request.object}`)
  const ActiveItem = Parse.Object.extend("ActiveItem")
  const query = new Parse.Query(ActiveItem)
  // query.equalTo("marketPlaceAddress", request.object.get("address"))
  query.equalTo("nftAddress", request.object.get("nftAddress"))
  query.equalTo("tokenId", request.object.get("tokenId").toString())
  logger.info(`Marketplace | Query: ${query}`)
  const canceledItem = await query.first()
  logger.info(`Marketplace | CanceledItem: ${JSON.stringify(canceledItem)}`)
  if(canceledItem){
    logger.info(`Deleting ${canceledItem.id}`)
    await canceledItem.destroy()
    logger.info(
      `Deleted item with tokenId ${request.object.get(
          "tokenId"
      ).toString()} at address ${request.object.get("address")} since it was canceled. `
    )
  }else{
    logger.info(
      `No item canceled with address: ${request.object.get(
          "address"
      )} and tokenId: ${request.object.get("tokenId").toString()} found.`
    )
  }
})

Parse.Cloud.define('watchContractEvent', async ({ params, user, ip }: any) => {
  let provider: any;
  const sepoliaUrl = process.env.SEPOLIA_RPC_URL ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545/'
  if (params['chainId'] == 1337) {
    provider = new ethers.providers.WebSocketProvider('http://127.0.0.1:8545/');
  } else {
    provider = new ethers.providers.WebSocketProvider(sepoliaUrl);
  }
  console.log("params : ", params)
  console.log("ip : ", ip)
  console.log("user : ", user )
  const contractAddress = params['address'];

  const contract = new ethers.Contract(contractAddress, [params['abi']], provider);
  if (params['tableName'] == 'ItemBought') {
    console.log("===================================================================")
    contract.on('ItemBought', async (buyer, nftAddress, tokenId, price, event) => {
      try{
        const ItemBought = await Parse.Object.extend('ItemBought');
        const itemBought = new ItemBought();  
        itemBought.set('buyer', buyer);
        itemBought.set('nftAddress', nftAddress);
        itemBought.set('tokenId', tokenId.toString());
        itemBought.set('price', ethers.utils.formatUnits(price, 6));
        itemBought.save();
      }catch(e){
        console.log("Error when bough item ", e)
      }
    });
    
    return { success: true };
  }
  if (params['tableName'] == 'ItemListed') {
    console.log("===================================================================")
    contract.on('ItemListed', async (seller, nftAddress, tokenId, price, event) => {
      const ItemListed = await Parse.Object.extend('ItemListed');
      console.log("get transaction receipt", await event.getTransactionReceipt())
      const itemListed = new ItemListed();
      itemListed.set('seller', seller);
      itemListed.set('nftAddress', nftAddress);
      itemListed.set('tokenId', tokenId.toString());
      itemListed.set('price', ethers.utils.formatUnits(price, 6));
      console.log("item listed 2", itemListed)
      itemListed.save();
    });
    return { success: true };
  }
  if (params['tableName'] == 'ItemCanceled') {
    console.log("===================================================================")
    contract.on('ItemCanceled', async (seller, nftAddress, tokenId, event) => {
      const ItemCanceled = await Parse.Object.extend('ItemCanceled');
      const itemCanceled = new ItemCanceled();
      itemCanceled.set('seller', seller);
      itemCanceled.set('nftAddress', nftAddress);
      itemCanceled.set('tokenId', tokenId.toString());
      itemCanceled.save();
    });
    return { success: true };
  }
  return { success: false };
});
