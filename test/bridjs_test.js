/*
 * BridJS - Dynamic and blazing-fast native interop for JavaScript.
 * https://github.com/jiahansu/BridJS
 *
 * Copyright (c) 2013-2013, Olivier Chafik (http://ochafik.com/) 
 * and Jia-Han Su (https://github.com/jiahansu/BridJS)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Olivier Chafik nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY OLIVIER CHAFIK, JIA-HAN SU AND CONTRIBUTORS 
 * ``AS IS'' AND ANY * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED 
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR 
 * PURPOSE ARE * DISCLAIMED. IN NO EVENT SHALL THE REGENTS AND CONTRIBUTORS BE 
 * LIABLE FOR ANY * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
var assert = require('assert'), bridjs = require('../lib/bridjs.js'), log4js = require("log4js"),
        Utils = require("../lib/utils.js"), my = require('myclass');
var log = log4js.getLogger("BridjsTest"), libPath;

var interval = setInterval(function() {
    log.info("keep test alive");
}, 999999999);
var lib;

{/*Test dynload block*/
    libPath = __dirname + "/" + bridjs.LIBRARY_PATH + ".node";
    log.info(libPath);
    //log.info("Lib: " + JSON.stringify(lib) + ", symbols: " + bridjs.symbols(libPath));
    log.info("Test dynload pass");

}
{/*Test dyncall block*/
    log.info("Test dyncall");

    var lib = null, vm = null, testMultiplyFunction, dyncall = bridjs.dc, ret,
            Signature = bridjs.dc.Signature, NativeFunction = bridjs.dc.NativeFunction, nativeFunction,
            startSeconds, CallbackObject, afterDyncallTest, afterDyncallbackTest, callbackHandler,
            i, iteration = 100000, dcbCallbackCount = 2, testStruct, testStructBuffer,
            offset, os = require("os"), typeSize, testStructFunction, structObject, 
            testStructValueFunction, arrayStruct;
    //console.log(libPath); 

    CallbackObject = my.Class({
        onDone: function(vm, result) {
            log.info("onDone: " + result);
            afterDyncallTest();
        },
        onError: function(vm, result) {
            log.info("onError: " + result);
        }
    });

    DcbCallbackObject = my.Class({
        onDone: function(w, x, y, z, e) {
            var value = w * x * y * z * e;

            --dcbCallbackCount;

            log.info("onDcbCallback: " + value + ", count = " + dcbCallbackCount);

            if (dcbCallbackCount <= 0) {
                setTimeout(afterDyncallbackTest, 1000);
            }

            return value;
        }
    });

    try {
        
        log.info("Pointer's size = "+bridjs.getTypeSize(Signature.POINTER_TYPE));
        
        startSeconds = Utils.timeSeconds();
        for (i = 0; i < iteration; ++i) {
            ret = bridjs.test.testMultiplyFunction(2, 2, 2, 2, 2.5);
        }
        log.info("Spend " + ((Utils.timeSeconds() - startSeconds) / iteration) + " to invoke testMultiplyFunction by native binding");
        log.info("2 x 2 x 2 x 2 x 2.5 = " + ret);

        lib = bridjs.dl.loadLibrary(libPath);
        testMultiplyFunction = bridjs.dl.findSymbol(lib, "testMultiplyFunction");
        testStructFunction = bridjs.dl.findSymbol(lib, "testStructFunction");
        testStructValueFunction = bridjs.dl.findSymbol(lib, "testStructValueFunction");

        vm = dyncall.newCallVM(4096);
        //log.info("vm pointer: "+JSON.stringify(vm));
        dyncall.mode(vm, bridjs.dc.CALL_C_DEFAULT);
        dyncall.reset(vm);
        startSeconds = Utils.timeSeconds();
        for (i = 0; i < iteration; ++i) {
            dyncall.reset(vm);
            dyncall.argShort(vm, 2);
            dyncall.argInt(vm, 2);
            dyncall.argLong(vm, 2);
            dyncall.argLongLong(vm, 2);
            dyncall.argDouble(vm, 2.5);
            ret = dyncall.callDouble(vm, testMultiplyFunction);
        }
        log.info("Spend " + ((Utils.timeSeconds() - startSeconds) / iteration) + " to invoke testMultiplyFunction by dyncall");
        assert(ret === 40, "Call testMultiplyFunction fail");


        assert(Signature.INT32_TYPE === 'i', "invalid int32 type");
        assert(Signature.INT_TYPE === 'i', "invalid int32 type");

        nativeFunction = new NativeFunction(testMultiplyFunction,
                Signature.DOUBLE_TYPE, Signature.INT16_TYPE, Signature.INT32_TYPE,
                Signature.LONG_TYPE, Signature.LONGLONG_TYPE, Signature.DOUBLE_TYPE);

        log.info("returnType = " + nativeFunction.getReturnType() + ", argumentsLength = " + nativeFunction.getArgumentsLength());

        startSeconds = Utils.timeSeconds();
        for (i = 0; i < iteration; ++i) {
            ret = nativeFunction.call(vm, 2, 2, 2, 2, 2.5);
        }
        log.info("Spend " + ((Utils.timeSeconds() - startSeconds) / iteration) + " to invoke testMultiplyFunction by NativeFunction");
        log.info("2 x 2 x 2 x 2 x 2.5 = " + nativeFunction.call(vm, 2, 2, 2, 2, 2.5));

        nativeFunction.callAsync(4096, 2, 2, 2, 2, 2.5, new CallbackObject());

        if (testStructFunction) {
            structObject = new bridjs.dyncall.Struct(Signature.INT16_TYPE, Signature.INT32_TYPE,
                    Signature.LONG_TYPE, Signature.LONGLONG_TYPE, Signature.DOUBLE_TYPE);
            testStruct = dyncall.newStruct(5, dyncall.DEFAULT_ALIGNMENT);
            dyncall.structField(testStruct, Signature.INT16_TYPE, dyncall.DEFAULT_ALIGNMENT, 1);
            dyncall.structField(testStruct, Signature.INT32_TYPE, dyncall.DEFAULT_ALIGNMENT, 1);
            dyncall.structField(testStruct, Signature.LONG_TYPE, dyncall.DEFAULT_ALIGNMENT, 1);
            dyncall.structField(testStruct, Signature.LONGLONG_TYPE, dyncall.DEFAULT_ALIGNMENT, 1);
            dyncall.structField(testStruct, Signature.DOUBLE_TYPE, dyncall.DEFAULT_ALIGNMENT, 1);
            dyncall.closeStruct(testStruct);

            log.info("TestStruct's size: "+ structObject.getSize()+", "+bridjs.getTypeSize(Signature.LONG_TYPE));
            
            testStructBuffer = new Buffer(structObject.getSize());

            structObject.setField(0, 2, testStructBuffer);
            structObject.setField(1, 2, testStructBuffer);
            structObject.setField(2, 2, testStructBuffer);
            structObject.setField(3, 2, testStructBuffer);
            structObject.setField(4, 2.5, testStructBuffer);

            assert(structObject.getField(3, testStructBuffer) === 2, "Call Struct.getField fail");
            startSeconds = Utils.timeSeconds();
            //for (i = 0; i < iteration; ++i) {
            dyncall.reset(vm);
            dyncall.argPointer(vm, testStructBuffer);
            ret = dyncall.callDouble(vm, testStructFunction);
            log.info("testStructFunction: " + ret);
            log.info("Spend " + ((Utils.timeSeconds() - startSeconds)) + " to invoke testStructFunction by dyncall");
            assert(ret === 40, "Call testStructFunction fail");

            dyncall.freeStruct(testStruct);
            testStruct = null;
        } else {
            throw "Fail to locate testStructFunction from native lirary";
        }
        
        arrayStruct = new bridjs.dc.ArrayStruct(Signature.CHAR_TYPE, 3);
        testStructBuffer = new Buffer(arrayStruct.getSize());
        log.info("Array struct's size: "+arrayStruct.getSize());
        
        arrayStruct.setField(0, 'x', testStructBuffer);
        arrayStruct.setField(1, 'y', testStructBuffer);
        arrayStruct.setField(2, 'z', testStructBuffer);
        //log.info(arrayStruct.getField(1, testStructBuffer));
        assert(arrayStruct.getField(1, testStructBuffer)==='y', "Fail to access ArrayStruct's element");
        
        log.info("Test dyncall pass");
    } catch (e) {
        log.error(e);
    } finally {
        /*
         if(vm){
         bridjs.dc.free(vm);
         }
         
         if(lib){
         bridjs.dl.freeLibrary(lib);
         }*/
    }

    afterDyncallTest = function() {
        var testCallbackFunction, testAsyncCallbackFunction;
        log.info("Test dyncallback start:");

        callbackHandler = bridjs.dcb.newCallback(Signature.DOUBLE_TYPE, [Signature.INT16_TYPE, Signature.INT32_TYPE,
            Signature.LONG_TYPE, Signature.LONGLONG_TYPE, Signature.DOUBLE_TYPE], new DcbCallbackObject());

        testCallbackFunction = bridjs.dl.findSymbol(lib, "testCallbackFunction");
        testAsyncCallbackFunction = bridjs.dl.findSymbol(lib, "testAsyncCallbackFunction");

        /*testCallbackFunction*/
        startSeconds = Utils.timeSeconds();
        //for(i=0;i<iteration;++i){
        dyncall.reset(vm);
        dyncall.argPointer(vm, callbackHandler);
        dyncall.callVoid(vm, testCallbackFunction);
        //}
        log.info("Spend " + ((Utils.timeSeconds() - startSeconds)) + " to invoke testCallbackFunction by dyncall");

        /*testAsyncCallbackFunction*/
        startSeconds = Utils.timeSeconds();
        //for(i=0;i<iteration;++i){
        dyncall.reset(vm);
        dyncall.argPointer(vm, callbackHandler);
        dyncall.callVoid(vm, testAsyncCallbackFunction);
        //}
        log.info("Spend " + ((Utils.timeSeconds() - startSeconds)) + " to invoke testAsyncCallbackFunction by dyncall");

        log.info("callback handler: " + testCallbackFunction);
    };
    afterDyncallbackTest = function() {
        if (callbackHandler) {
            bridjs.dcb.freeCallback(callbackHandler);
        }
        log.info("Test dyncallback pass");

        log.info("Release dyncall resources");
        if (vm) {
            bridjs.dc.free(vm);
        }

        if (lib) {
            bridjs.dl.freeLibrary(lib);
        }

        /*Test Prototype binding*/
        {
            log.info("Test prototype binding start");

            var Tester, testerInstance, TestStruct, testStruct, TestComplexStruct, Point2d,Point3d, 
                testComplexStruct, point3d, TestArrayStruct, testArrayStruct, callback, testStruct2, 
                HugeArrayStruct, structCallback, 
                DoubleValue = bridjs.NativeValue.double, 
                doubleValue, testString = "test_string", strBuffer1 = new Buffer(256)
                , strBuffer2 = new Buffer(256), size;

            //bridjs.register(Tester, libPath);
             TestStruct = bridjs.defineStruct({
                x : bridjs.structField(Signature.INT16_TYPE,0),
                y : bridjs.structField(Signature.INT32_TYPE,1),
                z : bridjs.structField(Signature.LONG_TYPE,2),
                w : bridjs.structField(Signature.LONGLONG_TYPE,3),
                e : bridjs.structField(Signature.DOUBLE_TYPE,4)
            });
            
            Tester = bridjs.defineModule({
                testMultiply: bridjs.defineFunction(Signature.double, Signature.int16, Signature.int32,
                        Signature.long, Signature.longlong, Signature.double).bind("testMultiplyFunction"),
                testStructFunction: bridjs.defineFunction(Signature.DOUBLE_TYPE, Signature.POINTER_TYPE),
                testStringFunction: bridjs.defineFunction(Signature.string, Signature.string),
                testComplexStructFunction :  bridjs.defineFunction(Signature.DOUBLE_TYPE, Signature.POINTER_TYPE),
                testArrayStructFunction : bridjs.defineFunction(Signature.DOUBLE_TYPE, Signature.POINTER_TYPE),
                testAsyncCallbackFunction : bridjs.defineFunction(Signature.VOID_TYPE, Signature.POINTER_TYPE),
                testStructPassByPointerFunction:bridjs.defineFunction(bridjs.byPointer(TestStruct), Signature.POINTER_TYPE).cacheInstance(false),
                testStructPassByPointerFunctionWithCacheInstance:bridjs.defineFunction(bridjs.byPointer(TestStruct), Signature.POINTER_TYPE).bind("testStructPassByPointerFunction").cacheInstance(true),
                testStructCallbackFunction:bridjs.defineFunction(Signature.VOID_TYPE,bridjs.byPointer(TestStruct), Signature.POINTER_TYPE),
                testValuePassByPointerFunction:bridjs.defineFunction(bridjs.byPointer(DoubleValue),bridjs.byPointer(DoubleValue))
            }, libPath);

            testerInstance = new Tester();
            //log.info("Register Tester.testMultiplyFunctio: "+testerInstance.testMultiplyFunction);
            startSeconds = Utils.timeSeconds();
            for (i = 0; i < iteration; ++i) {
                ret = testerInstance.testMultiply(2, 2, 2, 2, 2.5);
            }
            log.info("Spend " + ((Utils.timeSeconds() - startSeconds) / iteration) + " to invoke Tester.testMultiplyFunction by prototype binding");
            assert(ret === 40, "Call Tester.testMultiplyFunction fail");


            bridjs.async(testerInstance).testMultiply(2, 2, 2, 2, 2.5, function(result) {
                log.info(" bridjs.async(testerInstance).testMultiplyFunction results: " + result);
            });
            
            callback = bridjs.newCallback(bridjs.defineFunction(Signature.DOUBLE_TYPE, Signature.INT16_TYPE, Signature.INT32_TYPE,
            Signature.LONG_TYPE, Signature.LONGLONG_TYPE, Signature.DOUBLE_TYPE), function(w, x, y, z, e) {
                return w * x * y * z * e;
            });
            testerInstance.testAsyncCallbackFunction(callback);
            
            //log.info(bridjs.async(testerInstance));
 
           
            Point2d = my.Class(bridjs.Struct,{
                constructor:function(){
                    Point2d.Super.call(this);
                },
                x : bridjs.structField(Signature.DOUBLE_TYPE,0),
                y : bridjs.structField(Signature.DOUBLE_TYPE,1)
            });
            Point3d = my.Class(bridjs.Struct,{
                constructor:function(){
                    Point3d.Super.call(this);
                },
                x : bridjs.structField(Signature.DOUBLE_TYPE,0),
                y : bridjs.structField(Signature.DOUBLE_TYPE,1),
                z : bridjs.structField(Signature.DOUBLE_TYPE,2)
            });
            //log.info(Signature.INT16_TYPE);
            TestComplexStruct = my.Class(bridjs.Struct,{
                constructor:function(){
                    TestComplexStruct.Super.call(this);
                },
                w:bridjs.structField(Signature.CHAR_TYPE,0),
		subStruct:bridjs.structField(TestStruct,1),
		x:bridjs.structField(Signature.INT16_TYPE,2),
		point2d:bridjs.structField(Point2d,3),
		y:bridjs.structField(Signature.INT32_TYPE,4),
		point3d:bridjs.structField(Point3d,5),
		z:bridjs.structField(Signature.INT64_TYPE,6)
            });
            
            TestArrayStruct = my.Class(bridjs.Struct,{
                constructor:function(){
                    TestArrayStruct.Super.call(this);
                },
                w:bridjs.structField(Signature.CHAR_TYPE,0),
                first:bridjs.structArrayField(Signature.CHAR_TYPE,3,1),
                second:bridjs.structArrayField(Signature.CHAR_TYPE,3,2)
            });
            
            HugeArrayStruct = bridjs.defineStruct({
                largeBuffer:bridjs.structArrayField(Signature.CHAR_TYPE,4*1024*1024,0)
            });
            
            log.info("HugeArrayStruct's size: "+bridjs.getTypeSize(HugeArrayStruct));
            
            
            testStruct = new TestStruct();
            testStruct.x = testStruct.y = testStruct.z = testStruct.w = 2;
            testStruct.e = 2.5;
            assert(testStruct.x === 2, "Struct's get/set property fail");
            //log.info(testStruct.getPointer());
            startSeconds = Utils.timeSeconds();
            for (i = 0; i < iteration; ++i) {
                ret = testerInstance.testStructFunction(bridjs.getStructPointer(testStruct));
            }
            log.info("Spend " + ((Utils.timeSeconds() - startSeconds) / iteration) + " to invoke Tester.testStructFunction by prototype binding");
            assert(ret === 40, "Call Tester.testStructFunction fail");
            
            testComplexStruct = new TestComplexStruct();
            ret = testComplexStruct.subStruct;
            assert((ret instanceof bridjs.Struct), "Fail to get sub-struct");
            
            testComplexStruct.w = testComplexStruct.x = testComplexStruct.y = testComplexStruct.z = 2;
            testComplexStruct.subStruct.e =  testComplexStruct.point2d.x = testComplexStruct.point3d.y = 2.5;
            ret = testComplexStruct.point3d.y;
            assert((ret === 2.5), "Fail to access sub-struct's element");
            
            ret = testerInstance.testComplexStructFunction(bridjs.getStructPointer(testComplexStruct));
            assert((ret === 250), "Fail to call testerInstance.testComplexStructFunction");
            
            point3d = new Point3d();
            point3d.x = point3d.y = point3d.z = 3.5;
            testComplexStruct.point3d = point3d;
            
            ret = testComplexStruct.point3d.z;
            assert((ret ===3.5), "Fail to set sub-struct");
            
            testArrayStruct = new TestArrayStruct();
            testArrayStruct.w = 1;
            testArrayStruct.first.set(1,2);
            testArrayStruct.second.set(2,'s');
            
            ret = testArrayStruct.second.get(2);
            assert((ret ==='s'), "Fail to access array field");
            
            ret = testerInstance.testArrayStructFunction(bridjs.getStructPointer(testArrayStruct));
            assert((ret ===230), "Fail to access array field");
            
            log.info("testArrayStruct's size: "+bridjs.getStructSize(testArrayStruct));
            try{
                ret = testerInstance.testArrayStructFunction(testArrayStruct);
                assert(false, "Fail to handle non-pointer type value");
            }catch(e){
                //pass
            }
            
            ret = testerInstance.testStructPassByPointerFunction(bridjs.getStructPointer(testStruct));
            
            testStruct2 = ret;

            assert(testStruct2.e === testStruct.e ,"Fail to call testerInstance.testStructPassByPointerFunction");
            
            ret = testerInstance.testStructPassByPointerFunction(bridjs.getStructPointer(testStruct));
            
            assert(testStruct2 !== ret ,"Fail to disable cacheInstance");
            
            ret = testerInstance.testStructPassByPointerFunctionWithCacheInstance(bridjs.getStructPointer(testStruct));
            testStruct2 = ret;
            ret = testerInstance.testStructPassByPointerFunctionWithCacheInstance(bridjs.getStructPointer(testStruct));
            
            assert(testStruct2 === ret ,"Fail to enable cacheInstance");
            
            bridjs.async(testerInstance).testStructPassByPointerFunction(bridjs.getStructPointer(testStruct), function(result){
                //log.info(result.e);
                assert(result.e === testStruct.e ,"Fail to call testerInstance.testStructPassByPointerFunction asynchronously");
            });
            
            structCallback  = bridjs.newCallback(bridjs.defineFunction(Signature.DOUBLE_TYPE, bridjs.byPointer(TestStruct)), function(testStructArg) {
                //log.info(testStructArg.e);
                assert(testStructArg.e === testStruct.e ,"Fail to call testerInstance.testStructCallbackFunction");
                
                return testStructArg.w * testStructArg.x * testStructArg.y * testStructArg.z * testStructArg.e;
            });
            testerInstance.testStructCallbackFunction(bridjs.byPointer(testStruct),structCallback);
            /*invoke twice for testing reuse case*/
            testerInstance.testStructCallbackFunction(bridjs.byPointer(testStruct),structCallback);
            doubleValue = new bridjs.NativeValue.double(2.5);
            
            console.log("doubleValue:"+doubleValue.get());
            
            ret = testerInstance.testValuePassByPointerFunction(bridjs.byPointer(doubleValue));
            //console.log("doubleValue:"+doubleValue.get());
            assert(doubleValue.get() === 2.5 ,"Fail to call testerInstance.testValuePassByPointerFunction");
            //bridjs.unregister(Tester);
            log.info("Test prototype binding pass");
            
            bridjs.async(testerInstance).testStringFunction(testString, function(result){
                //log.info(result.e);
                assert(testString===result ,"Fail to call testerInstance.testStringFunction asynchronously");
            });
            try{
                size = strBuffer1.write("test_string","utf-8");
            }catch(e){
                console.log(e.stack);
            }
            bridjs.utils.memoryCopy(strBuffer2, strBuffer1, size);
            //console.log(strBuffer2.toString("utf-8",0, size));
            assert(testString===strBuffer2.toString("utf-8",0, size), "Fail to call bridjs.utils.memcpy");
            /*
            assert(testString===testerInstance.testStringFunction(testString), 
            "Fail to call testerInstance.testStringFunction");*/
        }
        //clearInterval(interval);
    };

}