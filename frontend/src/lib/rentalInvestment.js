export function rentalInvestment(input){
 const {capital,rooms,rent,occupancy,monthlyCosts}=input;
 if(![capital,rooms,rent,occupancy,monthlyCosts].every(Number.isFinite)||capital<=0||capital>1e15||
 !Number.isInteger(rooms)||rooms<1||rooms>10000||rent<0||rent>1e8||occupancy<0||occupancy>100||monthlyCosts<0||monthlyCosts>1e12)return null;
 const gross=rooms*rent*occupancy/100,net=gross-monthlyCosts;
 return {gross,net,annualNet:net*12,paybackYears:net>0?capital/(net*12):null};
}
