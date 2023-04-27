import express from "express";
import { User } from "../Datastore/UserModel/UserModel";
import { addUserDetails, verifyUserLogin } from "./AuthenticationService";
import { tokenGenerator, tokenVerify } from "./TokenGenerator";
const router = express.Router();


router.post("/login" , async (req, res)=>{
    let request : User = req.body;
    let response = await verifyUserLogin(request.username , request.password);
    if(response && response.email && response.username){
        const token : string = tokenGenerator(response);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({
            username : request.username , 
            token : token,
            email : response.email
        });   
    }else{
        res.status(400).send("Invalid username or Password!");   
    }
     
});

router.post("/signUp" , async (req, res)=>{
    let request : User = req.body;
    const response : boolean = await addUserDetails(request);
    if(response){
        res.status(200).send("Verified User!");
    }else{
        res.status(400).send("Invalid Payload!");
    }
});

router.post("/verifyToken" , (req, res)=>{
    let request : User = req.body;
    if(request.username && request.token && request.email){
        if(tokenVerify(request.token , request.username , request.email)){
            res.status(200).send("Verified User!");
        }else{
            res.status(400).send("Invalid Crednetials!");
        }
    }
});

export default router;