// const MyObject = {

import { compute } from "three/src/nodes/gpgpu/ComputeNode.js";

//     property: "value",
//     otherProperty: 77,
//     "obnoxious property": function(){


//     },
// };

// console.log(MyObject.property);
// console.log(MyObject["obnoxious property"])

// const car = {

//     company: "lambo",
//     model: "avendator",
//     year: 2012,
//     color: "black",
//     priceUSD: 100000,

//     applydiscount: function(discount_perc){
//         const multiplier = 1-(discount_perc/100)        
//         this.priceUSD *= multiplier
//     },

//     getsummary(){

//         return `${this.year} ${this.company} ${this.model} available in ${this.color} "@" ${this.priceUSD}`
//     },

// };

// car.applydiscount(10)
// console.log(car.priceUSD)
// console.log(car.getsummary())


// Game as an object

const rps = {

    playerScore = 0,
    computerScore = 0,

    playRound(player_choice){
        // code to play round
    },

    getWinningPlayer(){
        // returns the player with the most points
    },

    reset(){
        // ressting 
    },
};

rps.playRound("rock")
console.log(playerScore)

rps.playRound("rock")
console.log(computerScore)
