let express=require("express");
const { MongoClient } = require("mongodb");
let app=express();
app.get("/get_data",async (req,res)=>{
    console.log("you have entered into the api")
    async function connectToMongoDB() {
        try {
          console.log("Entered into DB");
          const uri = "mongodb+srv://rvdevuser:Realv06032023@cluster0.q27d0.mongodb.net/?retryWrites=true&w=majority";
          const client = new MongoClient(uri);
          await client.connect().then(
            console.log("connected")
          ).catch(
            console.log("error")
          );
          // MongoClient.connect(`mongodb+srv://rvdevuser:Realv06032023@cluster0.q27d0.mongodb.net/?retryWrites=true&w=majority`, {maxPoolSize: 10}, (error, client) => {
          //   if (error !== undefined && error !== null) {
          //     // DI.get<Logger>(Logger).error("Unable to connect mongo db - uri: ", error);
          //     reject(error);
          //   }
          //   resolve(client);
          // })
          return {
            client: client,
            db: client.db("rr_dlr_1_dev")
          }
        }
        catch (error) {
          console.log("Error retrieving data from MongoDB", error);
        }
    }
    const mongo = await connectToMongoDB();
    //console.log("mongocoonection", mongo)
    const client = mongo?.client;
    const db = mongo?.db;
    let items_array = [];
    let items_Quantity = [];
    let itemsBatchDetails = []
    //SSconsole.log("DB details",db);

        if(db) {
          const collection_PO = db.collection("PO_Final");
          const collection_Inventory = db.collection("Customer_Inventory_Bulkupload");
          const result_PO = await collection_PO.find({ "Order_Id" : req.query.orderId}).toArray();
          // const result_PO = await collection_PO.find({ "Order_Id" : "Order001"}).toArray();
          const result_Inventory= await collection_Inventory.find({"Supplier_Id" : parseInt(req.query.supplierId)}).toArray();
          // const result_Inventory= await collection_Inventory.find({"Supplier_Id" : 102}).toArray();
          const inventoryItems = result_Inventory[0].Items; 
          
          let sortedBatches = [];
          for(let i=0;i<result_PO[0].Purchase_Order_Items.length;i++)
          {
            items_array.push(result_PO[0].Purchase_Order_Items[i].Item_Id);
            items_Quantity.push(result_PO[0].Purchase_Order_Items[i].Item_Quantity)
          }
          for(let i=0;i<items_array.length;i++){
            let itemsBatchDetailsSub = []
            for(let j=0;j<inventoryItems.length;j++){
              if (items_array[i] == inventoryItems[j].Item_Id){
                sortedBatches = inventoryItems[j].Batches;
                sortedBatches.sort((a, b) => {
                    const expiryDateA = new Date(a.Expiry_Date);
                    const expiryDateB = new Date(b.Expiry_Date);
                    return (expiryDateA - expiryDateB) ;
                });
                inventoryItems[j].Total_AvaliableQuantity -= items_Quantity[i];
                await collection_Inventory.updateOne(
                  { "Supplier_Id": parseInt(req.query.supplierId), "Items.Item_Id": items_array[i] },
                  { $set: { "Items.$.Total_AvaliableQuantity": inventoryItems[j].Total_AvaliableQuantity } }
                );
              }
            }
            let required_Quantity = items_Quantity[i];
            while(required_Quantity>0){
              let ele = 0;
              if(sortedBatches[ele].Avaliable_Quantity>=required_Quantity){
                itemsBatchDetailsSub.push(sortedBatches[ele])
                itemsBatchDetailsSub[itemsBatchDetailsSub.length-1].Avaliable_Quantity = required_Quantity;
                required_Quantity = 0;
              }
              else{
                let dummyQuantity = required_Quantity - sortedBatches[ele].Avaliable_Quantity;
                itemsBatchDetailsSub.push(sortedBatches[ele])
                itemsBatchDetailsSub[itemsBatchDetailsSub.length-1].Avaliable_Quantity = dummyQuantity;
                required_Quantity -= sortedBatches[ele].Avaliable_Quantity;
                let batchId = sortedBatches[ele].Batch_No
                await collection_Inventory.updateOne(
                  { "Supplier_Id": parseInt(req.query.supplierId), "Items.Item_Id": items_array[i] },
                  { $pull: { "Items.$.Batches": { Batch_No: batchId } } } 
                );
                sortedBatches.shift();
              }
            }
            itemsBatchDetails.push(itemsBatchDetailsSub);
            await collection_Inventory.updateOne(
              { "Supplier_Id": parseInt(req.query.supplierId), "Items.Item_Id": items_array[i] },
              { $set: { "Items.$.Batches": sortedBatches } }
            );
            console.log("Updated Available_Quantity for Item ", items_array[i]);
          }
          console.log(itemsBatchDetails)
        }
        else
        {
            console.log("Error in connection of DB");
        }
        for(let i=0;i<items_array.length;i++)
        {
            console.log("Item "+i+" is ",items_array[i]);
            console.log("Item Quantity "+i+" is ",items_Quantity[i])
        }
        res.send({itemsBatchDetails});
});
app.listen(6105,()=>{
    console.log("app is running on port 6105");
})
