/*
 * Copyright 2018 FZI Forschungszentrum Informatik
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package org.streampipes.connect.adapter.generic.protocol.set;

import org.apache.commons.io.IOUtils;
import org.apache.http.client.fluent.Request;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.streampipes.connect.SendToPipeline;
import org.streampipes.connect.adapter.generic.format.Format;
import org.streampipes.connect.adapter.generic.format.Parser;
import org.streampipes.connect.adapter.generic.guess.SchemaGuesser;
import org.streampipes.connect.adapter.generic.pipeline.AdapterPipeline;
import org.streampipes.connect.adapter.generic.protocol.Protocol;
import org.streampipes.connect.adapter.generic.sdk.ParameterExtractor;
import org.streampipes.model.connect.grounding.ProtocolDescription;
import org.streampipes.model.connect.guess.GuessSchema;
import org.streampipes.model.schema.EventSchema;
import org.streampipes.model.staticproperty.FreeTextStaticProperty;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class HttpProtocol extends Protocol {

    Logger logger = LoggerFactory.getLogger(Protocol.class);

    public static final String ID = "https://streampipes.org/vocabulary/v1/protocol/set/http";

    private String url;

    public HttpProtocol() {
    }

    public HttpProtocol(Parser parser, Format format, String url) {
        super(parser, format);
        this.url = url;
    }

    @Override
    public ProtocolDescription declareModel() {
        ProtocolDescription pd = new ProtocolDescription(ID,"HTTP Set","This is the " +
                "description for the http protocol");
        FreeTextStaticProperty urlProperty = new FreeTextStaticProperty("url", "url",
                "This property defines the URL for the http request.");

        pd.setSourceType("SET");
        pd.setIconUrl("rest.png");
        //TODO remove just for testing
//        urlProperty.setValue("https://opendata.bonn.de/api/action/datastore/search.json?resource_id=0a41c514-f760-4a17-b0a8-e1b755204fee&limit=100");

        pd.addConfig(urlProperty);
        return pd;
    }

    @Override
    public Protocol getInstance(ProtocolDescription protocolDescription, Parser parser, Format format) {
        ParameterExtractor extractor = new ParameterExtractor(protocolDescription.getConfig());
        String url = extractor.singleValue("url");

        return new HttpProtocol(parser, format, url);
    }

    @Override
    public void run(AdapterPipeline adapterPipeline) {

        // TODO fix this. Currently needed because it must be wait till the whole pipeline is up and running
        try {
            Thread.sleep(7000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        SendToPipeline stk = new SendToPipeline(format, adapterPipeline);

        InputStream data = getDataFromEndpoint();

        parser.parse(data, stk);
    }

    @Override
    public void stop() {

    }


    @Override
    public GuessSchema getGuessSchema() {


        InputStream dataInputStream = getDataFromEndpoint();

        List<byte[]> dataByte = parser.parseNEvents(dataInputStream, 20);

        EventSchema eventSchema= parser.getEventSchema(dataByte);

        GuessSchema result = SchemaGuesser.guessSchma(eventSchema, getNElements(20));

        return result;
    }

    @Override
    public List<Map<String, Object>> getNElements(int n) {

        List<Map<String, Object>> result = new ArrayList<>();

        InputStream dataInputStream = getDataFromEndpoint();

        List<byte[]> dataByteArray = parser.parseNEvents(dataInputStream, n);

        // Check that result size is n. Currently just an error is logged. Maybe change to an exception
        if (dataByteArray.size() < n) {
            logger.error("Error in HttpProtocol! User required: " + n + " elements but the resource just had: " +
                    dataByteArray.size());
        }

        for (byte[] b : dataByteArray) {
            result.add(format.parse(b));
        }

        return result;
    }

    public InputStream getDataFromEndpoint() {
        InputStream result = null;

        try {
            String s = Request.Get(url)
                    .connectTimeout(1000)
                    .socketTimeout(100000)
                    .execute().returnContent().asString();

            if (s.startsWith("ï")) {
                s = s.substring(3);
            }

            result = IOUtils.toInputStream(s, "UTF-8");

        } catch (IOException e) {
            e.printStackTrace();
        }

        return result;
    }

    @Override
    public String getId() {
        return ID;
    }
}